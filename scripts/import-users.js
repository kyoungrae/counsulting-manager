import { readFile } from 'node:fs/promises'
import { connectDatabase } from '../server/db.js'
import { cliDatabaseConfig, prepareUserImport } from '../server/users.js'

let client
try {
  const path = process.argv[2]
  if (!path) throw new Error('사용법: npm run import:users -- /절대경로/users.json')
  const users = await prepareUserImport(JSON.parse(await readFile(path, 'utf8')))
  const connection = await connectDatabase(cliDatabaseConfig())
  client = connection.client
  const collection = connection.db.collection('users')
  let imported = 0
  let skipped = 0
  for (const user of users) {
    const existing = await collection.findOne({ $or: [{ uid: user.uid }, { userId: user.userId }] })
    if (existing) {
      skipped++
      continue
    }
    await collection.insertOne(user)
    imported++
  }
  console.log(`사용자 이전 완료: 추가 ${imported}명, 기존 계정 유지 ${skipped}명`)
} catch (error) {
  console.error(`사용자 이전 실패: ${error.name === 'Error' ? error.message : error.name}`)
  process.exitCode = 1
} finally {
  await client?.close()
}
