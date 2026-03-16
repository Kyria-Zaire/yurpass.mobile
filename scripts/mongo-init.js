// MongoDB initialization script for local development
// Creates the application user with readWrite access to the yurpass database.
// Executed automatically by the mongo:7.0 entrypoint on first container start.

db = db.getSiblingDB('yurpass')

db.createUser({
  user: 'yurpass-app',
  pwd: process.env.MONGO_APP_PASSWORD,
  roles: [{ role: 'readWrite', db: 'yurpass' }],
})
