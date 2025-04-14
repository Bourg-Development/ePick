const express = require('express');
const router = express.Router();

const authRouter = require('./authRoutes');
const userRouter = require('./userRoutes');

router.use('/auth', authRouter);
router.use('/users', userRouter);

module.exports = router;