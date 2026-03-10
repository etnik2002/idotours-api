const cron = require('node-cron');
const axios = require('axios');
const Payouts = require('../../models/Payouts');
const Operator = require('../../models/Operator');

class AutoPayoutsCronjob {
    constructor(apiUrl = process.env.API_URL || 'http://localhost:3000') {
        this.apiUrl = apiUrl;
        this.cronJob = null;
        this.isRunning = false;
    }

    generateReferenceNumber() {
        const timestamp = Date.now().toString();
        const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        return `AUTO-${timestamp}-${random}`;
    }

    getMonthName(monthNumber) {
        const months = [
            'january', 'february', 'march', 'april', 'may', 'june',
            'july', 'august', 'september', 'october', 'november', 'december'
        ];
        return months[monthNumber - 1];
    }

    getPreviousMonthYear() {
        const now = new Date();
        const previousMonth = now.getMonth() === 0 ? 12 : now.getMonth();
        const previousYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

        return {
            month: this.getMonthName(previousMonth),
            year: previousYear.toString()
        };
    }

    async calculateOperatorDebt(operatorId, month, year) {
        try {
            const response = await axios.get(
                `${this.apiUrl}/operator/reports/debt/owed/${operatorId}`,
                {
                    params: { month, year }
                }
            );

            const debts = response.data.data || [];
            const totalDebt = debts.reduce((sum, debt) => sum + debt.debt, 0);

            return Math.round(totalDebt * 100);
        } catch (error) {
            console.error(`Error calculating debt for operator ${operatorId}:`, error.message);
            return 0;
        }
    }

    async createPayout(operator, debtInCents, month, year) {
        try {
            const existingPayout = await Payouts.findOne({
                operator_id: operator._id,
                'time_period.month': month,
                'time_period.year': year
            });

            if (existingPayout) {
                console.log(`Payout already exists for operator ${operator._id} for ${month} ${year}`);
                return null;
            }

            if (debtInCents <= 0) {
                console.log(`No debt found for operator ${operator._id} for ${month} ${year}`);
                return null;
            }

            const payout = new Payouts({
                operator_id: operator._id,
                requested_amount_in_cents: debtInCents,
                payment_status: 'pending',
                time_period: {
                    month: month,
                    year: year
                },
                reference_umber: this.generateReferenceNumber(),
                notes: `Automatic payout for ${month} ${year}`,
                is_confirmed_by_gobusly: false
            });

            await payout.save();
            console.log(`Created automatic payout for operator ${operator._id}: €${(debtInCents / 100).toFixed(2)}`);

            return payout;
        } catch (error) {
            console.error(`Error creating payout for operator ${operator._id}:`, error.message);
            return null;
        }
    }

    async getOperatorsWithAutomaticPayouts() {
        try {
            return await Operator.find({
                'company_metadata.payouts.automatic_scheduled_payouts': true
            });
        } catch (error) {
            console.error('Error fetching operators with automatic payouts:', error.message);
            return [];
        }
    }

    async processPayouts() {
        if (this.isRunning) {
            console.log('Automatic payout processing is already running. Skipping...');
            return;
        }

        this.isRunning = true;

        try {
            console.log('Starting automatic payout processing...');

            const { month, year } = this.getPreviousMonthYear();
            console.log(`Processing payouts for ${month} ${year}`);

            const operators = await this.getOperatorsWithAutomaticPayouts();
            console.log(`Found ${operators.length} operators with automatic payouts enabled`);

            let processedCount = 0;
            let createdPayouts = 0;
            const results = [];

            for (const operator of operators) {
                try {
                    const debtInCents = await this.calculateOperatorDebt(
                        operator._id,
                        month,
                        year
                    );

                    const payout = await this.createPayout(
                        operator,
                        debtInCents,
                        month,
                        year
                    );

                    results.push({
                        operatorId: operator._id,
                        operatorName: operator.name,
                        debtAmount: debtInCents / 100,
                        payoutCreated: !!payout,
                        payoutId: payout?._id
                    });

                    if (payout) {
                        createdPayouts++;
                    }

                    processedCount++;
                } catch (error) {
                    console.error(`Error processing operator ${operator._id}:`, error.message);
                    results.push({
                        operatorId: operator._id,
                        operatorName: operator.name,
                        error: error.message,
                        payoutCreated: false
                    });
                }
            }

            console.log(`Automatic payout processing completed. Processed: ${processedCount}, Created: ${createdPayouts}`);

            return {
                success: true,
                processed: processedCount,
                created: createdPayouts,
                period: { month, year },
                results
            };

        } catch (error) {
            console.error('Error in automatic payout processing:', error.message);
            return {
                success: false,
                error: error.message
            };
        } finally {
            this.isRunning = false;
        }
    }

    start() {
        if (this.cronJob) {
            console.log('Automatic payout cron job is already running');
            return;
        }

        this.cronJob = cron.schedule('0 9 5 * *', async () => {
            console.log(`Running automatic payout cron job at ${new Date().toISOString()}`);
            await this.processPayouts();
        }, {
            scheduled: true,
            timezone: "Europe/Rome"
        });

        console.log('Automatic payout cron job scheduled for 5th of each month at 9:00 AM');
    }

    stop() {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
            console.log('Automatic payout cron job stopped');
        }
    }

    async runManually() {
        console.log('Running manual payout processing...');
        return await this.processPayouts();
    }

    getStatus() {
        return {
            isScheduled: !!this.cronJob,
            isRunning: this.isRunning,
            nextRun: this.cronJob ? this.cronJob.getStatus() : null
        };
    }
}

module.exports = AutoPayoutsCronjob;
