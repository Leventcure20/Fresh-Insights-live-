import express from "express";
import db from "../db/db.js";
import bcrypt from "bcryptjs";
import passport from "passport";
import { Strategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth20";


const router = express.Router();


router.get("/dashboard", (req, res) => {
   if (req.isAuthenticated()) {
        res.render("dashboard.ejs");
   } else {
    res.redirect("/login");
   }
});

export function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next(); // Proceed to the next middleware or route handler
    }
    res.redirect("/login"); // Redirect to login page if not authenticated
}

router.get("/auth/google", passport.authenticate("google", {
    scope: ["profile", "email"],
    prompt: "select_account",
})
);

router.get("/auth/google/dashboard", passport.authenticate("google", {
    successRedirect: "/dashboard",
    failureRedirect: "/login",
})
);

router.get("/logout", (req, res) => {
    req.logout((err) => {
        if (err) console.log(err)
            res.redirect("/");
    });
})



router.post("/login", passport.authenticate("local", {
    successRedirect: "/dashboard",
    failureRedirect: "/login",
}));


passport.use("local",
    new Strategy(
        { usernameField: "email" }, // Explicitly set the username field to "email"
        async function verify(email, password, cb) {
            try {
                const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
                if (result.rows.length === 0) {
                    return cb(null, false, { message: "User not found" });
                }

                const user = result.rows[0];
                const storedPassword = user.password;

                // Use await for bcrypt.compare
                const isMatch = await bcrypt.compare(password, storedPassword);
                if (isMatch) {
                    return cb(null, user);
                } else {
                    return cb(null, false, { message: "Incorrect password" });
                }
            } catch (err) {
                return cb(err);
            }
        }
    )
);

passport.use("google", new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "https://localhost:3000/auth/google/dashboard",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
}, async  (accessToken, refreshToken, profile, cb) => {
    // Extract email from profile
    const email = profile.emails?.[0]?.value || null;

    if (!email) {
        console.error("No email found in Google profile");
        return cb(new Error("No email associated with this Google account"), null);
    }

    try {
        // Use the extracted email variable
        const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
        
        if (result.rows.length === 0) {
            // Insert a new user if not found
            const newUser = await db.query(
                "INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *",
                [email, profile.id] // Using profile.id as a placeholder password
            );
            return cb(null, newUser.rows[0]);
        } else {
            // User already exists
            return cb(null, result.rows[0]);
        }
    } catch (err) {
        return cb(err);
    }
}));



passport.serializeUser((user, cb) => {
    cb(null, user);
});

passport.deserializeUser((user, cb) => {
    cb(null, user);
});


export default router;