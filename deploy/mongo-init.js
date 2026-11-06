/* global db */
const databaseName = process.env.MONGO_INITDB_DATABASE || 'consulting_manager'
const password = process.env.MONGO_APP_PASSWORD
if (!password) throw new Error('MONGO_APP_PASSWORD is required')

db.getSiblingDB(databaseName).createUser({
  user: 'consulting_app',
  pwd: password,
  roles: [{ role: 'readWrite', db: databaseName }],
})
