import express from 'express';
import bodyParser from 'body-parser';
import userRoutes from "./public/js/user.js";
import registerRoutes from "./public/auth/register.js";
import loginRoutes from "./public/auth/login.js";
import dotenv from "dotenv";
import session from 'express-session';
import passport from 'passport';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }, // 1 day
}));

// Passport initialization
app.use(passport.initialize());
app.use(passport.session());

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.json());
app.use(express.static("public"));

// Routes
app.use("/", userRoutes);
app.use("/", registerRoutes);
app.use("/", loginRoutes);

// Start the server
app.listen(PORT, () => {
    const host = process.env.NODE_ENV === "production"
        ? "https://fresh-insights-live.onrender.com"
        : `http://localhost:${PORT}`;
    console.log(`Server running on ${host}`);
});