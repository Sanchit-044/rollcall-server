const express = require("express");
const { getDashboard } = require("../controllers/dashboardController");
const { protect, requireTeacher } = require("../middleware/auth");

const router = express.Router();

router.get("/", protect, requireTeacher, getDashboard);

module.exports = router;
