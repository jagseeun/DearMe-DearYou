// routes/test.js
import express from "express"
import prisma from "../prisma/client.js"

const router = express.Router()

// GET http://localhost:3000/test/users
router.get("/users", async (req, res) => {
  const users = await prisma.user.findMany()
  res.json(users)
})

export default router
