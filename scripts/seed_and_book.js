const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');
const Ticket = require('../models/Ticket');
const Route = require('../models/Route');
const Booking = require('../models/Booking');
const Station = require('../models/Station');
const Operator = require('../models/Operator');

const OPERATOR_ID = 'process.env.HARDCODED_OPERATOR_ID';
const DB_URL = process.env.DATABASE_URL || process.env.PROD_DATABASE_URL;

async function run() {
    try {
        await mongoose.connect(DB_URL);
        console.log('Connected to database');

        // 1. Seed Users
        const userCount = await User.countDocuments();
        let seededUsers = [];
        if (userCount === 0) {
            console.log('Seeding users...');
            seededUsers = await User.insertMany([
                { name: 'John Doe', email: 'john@example.com', password: 'password123', phone: '123456789' },
                { name: 'Jane Smith', email: 'jane@example.com', password: 'password123', phone: '987654321' },
                { name: 'Ali Khan', email: 'ali@example.com', password: 'password123', phone: '555123456' }
            ]);
            console.log(`Seeded ${seededUsers.length} users`);
        } else {
            seededUsers = await User.find().limit(5);
            console.log('Using existing users');
        }

        // 2. Setup Stations
        let stationTetovo = await Station.findOne({ city: 'Tetovo' });
        if (!stationTetovo) {
            stationTetovo = await Station.create({
                name: 'Tetovo Main Station',
                city: 'Tetovo',
                country: 'Macedonia',
                code: 'TET'
            });
        }

        let stationPakistan = await Station.findOne({ city: 'Pakistan' });
        if (!stationPakistan) {
            stationPakistan = await Station.create({
                name: 'Islamabad Central',
                city: 'Pakistan',
                country: 'Pakistan',
                code: 'PAK'
            });
        }

        // 3. Setup Route
        let route = await Route.findOne({
            'destination.from': 'Tetovo',
            'destination.to': 'Pakistan',
            operator: OPERATOR_ID
        });

        if (!route) {
            console.log('Creating Route: Tetovo -> Pakistan...');
            route = await Route.create({
                code: 'TET-PAK-001',
                destination: { from: 'Tetovo', to: 'Pakistan' },
                stations: { from: stationTetovo._id, to: stationPakistan._id },
                operator: OPERATOR_ID,
                contact: { phone: '070123456', email: 'info@operator.com' },
                luggages: { free: 1, price_for_extra: 5, size: '20kg' },
                is_active: true
            });
        }

        // 4. Setup Ticket
        let ticket = await Ticket.findOne({ route_number: route._id });
        if (!ticket) {
            console.log('Creating Ticket for Route...');
            ticket = await Ticket.create({
                route_number: route._id,
                destination: { from: 'Tetovo', to: 'Pakistan' },
                operator: OPERATOR_ID,
                departure_date: new Date(Date.now() + 86400000), // Tomorrow
                time: '10:00',
                type: 'one_way',
                number_of_tickets: 40,
                is_active: true,
                stops: [{
                    from: stationTetovo._id,
                    to: stationPakistan._id,
                    time: '10:00',
                    price: 150,
                    departure_date: new Date(Date.now() + 86400000)
                }]
            });
        }

        // 5. Create Booking
        const randomUser = seededUsers[Math.floor(Math.random() * seededUsers.length)];
        console.log(`Creating booking for user: ${randomUser.name}`);

        const booking = await Booking.create({
            user: randomUser._id,
            ticket: ticket._id,
            route: route._id,
            operator: OPERATOR_ID,
            departure_date: ticket.departure_date,
            destinations: {
                departure_station: stationTetovo._id,
                arrival_station: stationPakistan._id,
                departure_station_label: 'Tetovo Main Station',
                arrival_station_label: 'Islamabad Central'
            },
            labels: {
                from_city: 'Tetovo',
                to_city: 'Pakistan'
            },
            passengers: [{
                full_name: randomUser.name,
                email: randomUser.email,
                phone: randomUser.phone,
                price: 150
            }],
            price: 150,
            is_paid: 'true',
            platform: 'WEB'
        });

        console.log('Booking created successfully:', booking._id);

    } catch (error) {
        console.error('Error running script:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from database');
    }
}

run();
