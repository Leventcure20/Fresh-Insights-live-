import express from "express";
import db from "../db/db.js";
import bcrypt from "bcrypt";

const router = express.Router();
const saltRounds = 10;



router.post("/register", async (req, res) => {
    const { email, password, confirm_password } = req.body;
    try {
        const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [email]);

        if (checkResult.rows.length > 0) {
            res.render("register.ejs", {error: "Email already exists. Try logging in"});
        } else if (password.length < 8) {
            res.render("register.ejs", {error: "Password is too short. Try again"});
        } else if (password !== confirm_password) {
            res.render("register.ejs", {error: "Passwords don't match. Try again"});
        } else {
            bcrypt.hash(password, saltRounds, async (err, hash) => {
                if (err) {
                    console.log("Error hashing password: ", err);
                } else {
                    const result = await db.query("INSERT INTO users (email, password) VALUES ($1, $2) RETURNING *", [email, hash]);
                    const user = result.rows[0];
                    req.login(user, (err) => {
                        console.log(err);
                        res.redirect("/dashboard");
                    })
                }
            })
        }
    } catch (err) {
        console.log(err);
    }
});

export default router;

