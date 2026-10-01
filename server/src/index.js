import 'dotenv/config'
import mongoose from 'mongoose'

import { createApp } from './app.js'
import { loadConfig } from './config/env.js'

async function start() {
  const config = loadConfig()
  await mongoose.connect(config.MONGO_URI)
  const app = createApp(config)
  const server = app.listen(config.PORT, () => {
    console.log(`Focus Mode API listening on http://localhost:${config.PORT}/api/v1`)
  })

  async function shutdown(signal) {
    console.log(`${signal} received; shutting down.`)
    server.close(async () => {
      await mongoose.disconnect()
      process.exit(0)
    })
  }
  process.once('SIGINT', () => shutdown('SIGINT'))
  process.once('SIGTERM', () => shutdown('SIGTERM'))
}

start().catch((error) => {
  console.error(`Server failed to start: ${error.message}`)
  process.exitCode = 1
})