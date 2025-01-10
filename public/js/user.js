import express from "express";
import db from "../db/db.js";
import { isAuthenticated } from "../auth/login.js";
import methodOverride from "method-override";
import bcrypt from "bcryptjs";


const router = express.Router();
const saltRounds = 10;



router.use(methodOverride('_method'));

router.get("/", (req, res) => {
    res.render("index.ejs");
});

router.get("/register", (req, res) => {
    res.render("register.ejs");
});

router.get("/login", (req, res) => {
    res.render("login.ejs");
});

router.get("/about", (req, res) => {
    res.render("about.ejs");
});

router.get("/allposts", isAuthenticated, async (req, res) => {
    const user = req.user.user_id;
    try {
        const response = await db.query(`
            SELECT 
                blogs.blog_id AS post_id,
                blogs.title AS post_title,
                blogs.content AS post_content,
                blog_users.email AS post_author_email,
                blog_users.user_id AS post_author_id,
                comments.comment_id,
                comments.content AS comment_content,
                comment_users.email AS comment_author_email,
                comment_users.user_id AS comment_author_id -- Include the commenter's ID
            FROM 
                blogs
            INNER JOIN 
                users AS blog_users ON blogs.user_id = blog_users.user_id
            LEFT JOIN 
                comments ON blogs.blog_id = comments.blog_id
            LEFT JOIN 
                users AS comment_users ON comments.user_id = comment_users.user_id
            ORDER BY 
                blogs.blog_id ASC, comments.comment_id ASC;

        `);

        // Organize data by grouping comments under their respective posts
        const dataMap = new Map();
        response.rows.forEach(row => {
            if (!dataMap.has(row.post_id)) {
                dataMap.set(row.post_id, {
                    post_id: row.post_id,
                    post_title: row.post_title,
                    post_content: row.post_content,
                    post_author_email: row.post_author_email,
                    post_author_id: row.post_author_id,
                    comments: []
                });
            }
            if (row.comment_id) {
                dataMap.get(row.post_id).comments.push({
                    comment_id: row.comment_id,
                    comment_content: row.comment_content,
                    comment_author_email: row.comment_author_email,
                    comment_author_id: row.comment_author_id 
                });
            }
        });

        // Convert the Map to an array
        const data = Array.from(dataMap.values());

        res.render("allposts.ejs", { data, user });
    } catch (error) {
        console.error(error);
        res.render("error.ejs", { error: "Page not found" });
    }
});

router.get("/reply/:id", isAuthenticated, async (req, res) => {
    const commentId = parseInt(req.params.id);
    const response = await db.query("SELECT * FROM comments WHERE comment_id = $1", [commentId]);
    const comment = response.rows[0];
    res.render("reply.ejs", {comment});
});

router.post("/reply/:id", isAuthenticated, async (req, res) => {
    const comment = req.body.comment;
    const user = req.user.user_id;
    const blog_id = parseInt(req.params.id);
    await db.query("INSERT INTO comments (content, blog_id, user_id) VALUES ($1, $2, $3) RETURNING *", [comment, blog_id, user]);
    res.redirect("/allposts");
});


router.delete("/deleteComment/:id", isAuthenticated, async (req, res) => {
    const commentId = parseInt(req.params.id);
    await db.query("DELETE FROM comments WHERE comment_id = $1", [commentId]);
    res.redirect("/allposts");
});




router.get("/myposts", isAuthenticated, async (req, res) => {
    const id = req.user.user_id;
    try {
        const response = await db.query("SELECT * FROM blogs WHERE user_id = $1", [id]);
        const data = response.rows;
        if (response.rows.length > 0) {
            res.render("myposts.ejs", {data});
        } else {
            res.render("myposts.ejs", {error: "No posts to display"});
        }

    } catch (error) {
        res.render({error: "Page not found"});
    }
});

router.get("/comments/:id", isAuthenticated, async (req, res) => {
    const blogID = parseInt(req.params.id);
    res.render("comment.ejs", {blogID});
});

router.post("/comments/:id", isAuthenticated, async (req, res) => {
    const user = req.user.user_id;
    const comment = req.body.comment;
    const postID = parseInt(req.params.id);
    try {
        await db.query("INSERT INTO comments (blog_id, user_id, content) VALUES ($1, $2, $3)", [postID, user, comment]);
        res.redirect("/allposts");
    } catch (error) {
        res.json("comments.ejs", {error: "Failed to add comment"});
    }
});

router.get("/makepost", isAuthenticated, (req, res) => {
     res.render("makeNew.ejs");
});

router.post("/makepost", isAuthenticated, async (req, res) => {
    const user = req.user.user_id;
    const {title, content} = req.body;
    try {
        await db.query("INSERT INTO blogs (title, content, user_id) VALUES ($1, $2, $3) RETURNING *", [title, content, user]);
        res.redirect("/myposts");
    } catch (error) {
        res.render({error: "Error making post"});
    }
});

router.get("/editpost/:id", isAuthenticated, async (req, res) => {
    const blog_id = parseInt(req.params.id);
    try {
        const response = await db.query("SELECT * FROM blogs WHERE blog_id = $1", [blog_id]);
        if (response.rows.length > 0) {
            const post = response.rows[0]; // Extract the first (and only) row
            res.render("edit.ejs", { post }); // Pass post data to edit.ejs
        } else {
            res.status(404).render("edit.ejs", { error: "Post not found" });
        }
    } catch (error) {
        res.render({error: "Invalid request"});
    }
});

router.put("/editpost/:id", isAuthenticated, async (req, res) => {
    const {title, content} = req.body;
    const blog_id = parseInt(req.params.id);
    try {
        await db.query("UPDATE blogs SET title = $1, content = $2 WHERE blog_id = $3", [title, content, blog_id]);
        res.redirect("/myposts");
    } catch (error){
        res.render({error: "Error editing post!"});
    }
});


router.delete("/myposts/:id", isAuthenticated, async (req, res) => {
    const blog_id = parseInt(req.params.id);
    try {
        await db.query("DELETE FROM blogs WHERE blog_id = $1", [blog_id]);
        res.redirect("/myposts");
    } catch (error) {
        res.render({error: "Error deleting post."});
    }
});

router.get("/account", isAuthenticated, async (req, res) => {
    const user = req.user.user_id;
    try {
        const response = await db.query("SELECT * FROM users WHERE user_id = $1", [user]);
        const data = response.rows[0];
        res.render("account.ejs", {data});
    } catch (error) {
        res.render("account.ejs", {error: "No user information to be displayed"});
    }
});

router.get("/changePassword", isAuthenticated, async (req, res) => {
    try {
        res.render("password.ejs");
    } catch (error) {
        res.render("password.ejs", {error: "Invalid request"});
    }
});

router.put("/changePassword", isAuthenticated, async (req, res) => {
    const user = req.user.user_id;
    const { password, confirm_password } = req.body;
    try {
        if (password !== confirm_password) {
            res.render("password.ejs", {error: "Passwords don't match, try again"});
        } else if (password.length < 8) {
            res.render("password.ejs", {error: "Password is not long enough"});
        } else {
            bcrypt.hash(password, saltRounds, async (err, hash) => {
                await db.query("UPDATE users SET password = $1 WHERE user_id = $2 RETURNING *", [hash, user]);
            });
            res.render("password.ejs", {success: "Password successfully updated!"});
        }
    } catch (error) {
        res.render("password.ejs", {error: "Error changing password"});
    }
});













export default router;