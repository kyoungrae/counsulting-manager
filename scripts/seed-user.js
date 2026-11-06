import { connectDatabase } from '../server/db.js'
import { cliDatabaseConfig, prepareUser } from '../server/users.js'

let client
try {
  const user = await prepareUser({
    userId: process.env.BOOTSTRAP_USER_ID,
    password: process.env.BOOTSTRAP_PASSWORD,
    name: process.env.BOOTSTRAP_NAME || '관리자',
    email: process.env.BOOTSTRAP_EMAIL || '',
    role: process.env.BOOTSTRAP_ROLE || 'admin',
    status: 'approved',
  })
  const connection = await connectDatabase(cliDatabaseConfig())
  client = connection.client
  await connection.db.collection('users').insertOne(user)
  console.log('사용자 추가 완료:', user.userId)
} catch (error) {
  console.error(error.code === 11000 ? '이미 존재하는 계정입니다. 기존 계정을 덮어쓰지 않았습니다.' : `사용자 추가 실패: ${error.name === 'Error' ? error.message : error.name}`)
  process.exitCode = 1
} finally {
  await client?.close()
}
