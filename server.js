const numCPUs = require("os").cpus().length;
const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const cluster = require("cluster");
const { fetchLeads } = require("./helpers/data");
const { EnvTypes } = require("./helpers/types");
const { sendTestDepartureNotification, startBookingCronJob, startDepartureReminderCronJob } = require("./utils/cron_jobs/booking");
const { startAbandonedCheckoutCron } = require("./utils/cron_jobs/abandoned.checkout");
const { sendBookingReminderMessage } = require("./helpers/messaging");
const AutoPayoutsCronjob = require("./utils/cron_jobs/automatic-payouts");
const Ticket = require("./models/Ticket");
const { initializeMCP } = require("./mcp/server");
const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StreamableHTTPServerTransport } = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const { z } = require("zod");

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);

  for (let i = 0; i < 1; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    console.log(`Worker ${worker.process.pid} died`);
    cluster.fork();
  });

} else {
  require("dotenv").config();
  const helmet = require("helmet");
  const mongoose = require("mongoose");
  const cors = require("cors");
  const bodyParser = require("body-parser");
  const session = require('express-session');
  const MongoStore = require('connect-mongo');
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  const autoPayoutsCron = new AutoPayoutsCronjob();

  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  }));

  app.options('*', cors());


  const mcp = new McpServer({
    name: "gobusly-mcp",
    version: "1.0.0",
  });

  mcp.registerTool(
    "search_bus_routes",
    {
      description: "Search available bus routes",
      // 2. Replace the raw JSON object with z.object()
      inputSchema: z.object({
        from: z.string().describe("Departure station"),
        to: z.string().describe("Arrival station"),
      }),
    },
    async ({ from, to }) => {
      // 3. Ensure axios is imported (see below)
      const response = await axios.get(
        "https://api-v2.gobusly.com/ticket/search/find-nearest",
        {
          params: {
            departureStation: from,
            arrivalStation: to,
          },
        }
      );

      // 4. Return text content for best compatibility
      return {
        content: [{
          type: "text",
          text: JSON.stringify(response.data.data)
        }],
      };
    }
  );




  const operatorRoutes = require("./routes/operator");
  const agencyRoutes = require("./routes/agency");
  const routeRoutes = require("./routes/route");
  const stationRoutes = require("./routes/station");
  const ticketRoutes = require("./routes/ticket");
  const userRoutes = require("./routes/user");
  const paymentRoutes = require("./routes/payment");
  const driverRoutes = require("./routes/driver");
  const bookingRoutes = require("./routes/booking");
  const applicantRoutes = require("./routes/applicant");
  const voucherRoutes = require("./routes/voucher");
  const reportsRoutes = require("./routes/reports");
  const opReportsRoutes = require("./routes/operatorReports");
  const webhooksRoutes = require("./routes/webhooks");
  const bankingRoutes = require("./routes/banking");
  const payoutsRoutes = require("./routes/payouts");
  const affiliateRoutes = require("./routes/affiliate");
  const reviewRoutes = require("./routes/review");
  const contractRoutes = require("./routes/contract");
  const walletRoutes = require("./routes/wallet");
  const abandonedRoutes = require("./routes/abandonedCheckout");
  const seoRoutes = require("./routes/seo");

  app.use('/operator', operatorRoutes);
  app.use('/agency', agencyRoutes);
  app.use('/route', routeRoutes);
  app.use('/ticket', ticketRoutes);
  app.use('/user', userRoutes);
  app.use('/station', stationRoutes);
  app.use('/payment', paymentRoutes);
  app.use('/booking', bookingRoutes);
  app.use('/driver', driverRoutes);
  app.use('/applicant', applicantRoutes);
  app.use('/voucher', voucherRoutes);
  app.use('/reports', reportsRoutes);
  app.use('/operator/reports', opReportsRoutes);
  app.use('/webhook', webhooksRoutes);
  app.use('/banking', bankingRoutes);
  app.use('/payouts', payoutsRoutes);
  app.use('/affiliate', affiliateRoutes);
  app.use('/review', reviewRoutes);
  app.use('/contract', contractRoutes);
  app.use('/wallet', walletRoutes);
  app.use('/seo', seoRoutes);
  app.use('/', abandonedRoutes);

  var cookieParser = require('cookie-parser');

  app.use(bodyParser.json());
  app.use(cookieParser(process.env.ACCESS_TOKEN_SECRET));
  app.use(helmet());

  app.use(session({
    secret: process.env.ACCESS_TOKEN_SECRET,
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
      mongoUrl: process.env.PROD_DATABASE_URL,
    }),
  }));


  if (process.env.ENV_TYPE == EnvTypes.PROD) {
    mongoose.connect(process.env.PROD_DATABASE_URL)
      .then(() => {
        console.log("Connected to [PROD] database!")
        // kt sda najsin kur tsosen kejt reminder translations ene kur de testohet se funksionon 99.99999 % majr
        // startBookingCronJob();
      })
      .catch((err) => { console.log("Connection failed!", err) });
  } else {
    const username = 'etnikz2002';
    const password = 'Etnik002';
    const mongoUrl = `mongodb+srv://${username}:${encodeURIComponent(password)}@cluster0.wcfare1.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
    console.log({ mongoUrl });

    mongoose.connect(mongoUrl)
      .then(() => {
        console.log("Connected to [DEV] database!")
        // startDepartureReminderCronJob();
        // startAbandonedCheckoutCron();
        // autoPayoutsCron.start();
      })
      .catch((err) => { console.log("Connection failed!", err) });
  }

  // kjo o per ta cu ni reminder per ni test booking (tetov - berlin / etnik zeqiri)
  // sendTestDepartureNotification()

  const apicache = require("apicache");
  const cache = apicache.middleware;

  app.get("/autopayout-status", (req, res) => {
    res.json({ data: autoPayoutsCron.getStatus() })
  })

  app.post("/mcp", async (req, res) => {
    try {
      // Create a new transport for this request
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined
      });

      // Connect the existing global 'mcp' server to this transport
      await mcp.connect(transport);

      // Let the transport handle the request and response
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error("MCP Request Error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "MCP request failed" });
      }
    }
  });

  app.get('/leads', cache('10 minutes'), async (req, res) => {
    try {
      const leads = await fetchLeads();
      return res.status(200).json({ message: "Leads data", data: leads })
    } catch (error) {
      return res.status(500).json(error.message)
    }
  })

  app.get('/count', cache('10 minutes'), async (req, res) => {
    try {
      const count = await Ticket.countDocuments();
      return res.status(200).json({ message: "tickets count", data: count })
    } catch (error) {
      return res.status(500).json(error.message)
    }
  })

  const PORT = process.env.PORT || 1235;


  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server started on port ${PORT}`);
  });

}
