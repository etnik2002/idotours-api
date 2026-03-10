const cron = require('node-cron');
const Booking = require('../../models/Booking');
const { sendDepartureReminder } = require('../../helpers/email');
const { TravelFlexTypes } = require('../../helpers/types');
const { sendBookingReminderMessage } = require("../../helpers/messaging")
const moment = require("moment-timezone")

async function checkUpcomingDepartures() {
  try {
    const now = new Date();
    const threeHoursFromNow = new Date(now.getTime() + (3 * 60 * 60 * 1000));
    
    const windowStart = new Date(threeHoursFromNow.getTime() - (5 * 60 * 1000)); // 5 minutes before
    const windowEnd = new Date(threeHoursFromNow.getTime() + (5 * 60 * 1000));   // 5 minutes after
    
    const upcomingBookings = await Booking.find({
      departure_date: {
        $gte: windowStart,
        $lte: windowEnd
      },
      'metadata.refund_action.is_refunded': { $ne: true },
      'metadata.reminders.email_departure_reminder_sent': { $ne: true }
    }).select("departure_date passengers labels operator").populate('operator');
    
    if (upcomingBookings.length > 0) {
      for (const booking of upcomingBookings) {
        await processUpcomingBooking(booking);
      }
    } else {
      return;
    }
    
  } catch (error) {
    return error;
  }
}

async function processUpcomingBooking(booking) {
  try {
    await sendDepartureReminder(booking);
    
    await Booking.findByIdAndUpdate(booking._id, {
      'metadata.reminders.email_departure_reminder_sent': true
    });
    
  } catch (error) {
    return error;
  }
}

async function updateBookingAfterReminder(booking_id) {
  await Booking.findByIdAndUpdate(booking_id, {$set: { 'metadata.reminders.email_departure_reminder_sent': true }});
}

async function sendTestDepartureNotification() {
  const booking = await Booking.findById("68ac61ad73b58ab416d94310");
  await sendDepartureReminder(booking);
}


const cronJob = cron.schedule('0 * * * *', async () => {
  await checkUpcomingDepartures();
}, {
  scheduled: false, 
  timezone: "UTC"   
});

function startBookingCronJob() {
  cronJob.start();
}

function stopBookingCronJob() {
  cronJob.stop();
}

async function sendEmailReminder(booking) {
  try {
      sendDepartureReminder(booking)
      
      await Booking.findByIdAndUpdate(booking._id, {
          'metadata.reminders.email_departure_reminder_sent': true
      });
      
  } catch (error) {
      return error;
  }
}

async function checkDepartureReminders() {
  try {
      const now = new Date();
      const threeHoursFromNow = new Date(now.getTime() + (3 * 60 * 60 * 1000));
      
      const bookings = await Booking.find({
          departure_date: {
              $gte: now,
              $lte: threeHoursFromNow
          },
          'metadata.reminders.email_departure_reminder_sent': false,
          is_paid: 'true' 
      }).populate('user', 'notifications');

      for (const booking of bookings) {
          if((booking.user && booking.user.notifications.departure_reminders) || !booking.user) {
            await sendEmailReminder(booking);
          }

          if(!booking.metadata.travel_flex.includes(TravelFlexTypes.NO_FLEX)) {
            const minutesUntilDeparture = moment.utc(booking.departure_date).diff(moment.utc(), 'minutes');
            let timeMessage = '';
            if (minutesUntilDeparture <= 60) {
              timeMessage = `in ${minutesUntilDeparture} minutes`;
            } else {
              const hoursUntilDeparture = Math.floor(minutesUntilDeparture / 60);
              timeMessage = `in ${hoursUntilDeparture} hour${hoursUntilDeparture > 1 ? 's' : ''}`;
            }
          
            const message = `GoBusly Departure reminder: Your bus from ${booking?.labels?.from_city || 'departure'} to ${booking?.labels?.to_city || 'destination'} leaves ${timeMessage}! View booking: ${'https://gobusly.com/account/bookings/' + booking?._id}`;
            sendBookingReminderMessage(booking.passengers[0].phone, message);
            updateBookingAfterReminder(booking._id);
          }
      }
      
  } catch (error) {
    return error;
  }
}

const departureReminderJob = cron.schedule('*/30 * * * * *', async () => {
  await checkDepartureReminders();
}, {
  scheduled: true,
  timezone: "UTC"
});

function startDepartureReminderCronJob() {
  departureReminderJob.start();
}

module.exports = {
  startBookingCronJob,
  stopBookingCronJob,
  checkUpcomingDepartures,
  sendTestDepartureNotification,
  startDepartureReminderCronJob
};