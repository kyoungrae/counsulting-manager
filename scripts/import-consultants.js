import { readFile } from 'node:fs/promises'
import { connectDatabase } from '../server/db.js'
import { cliDatabaseConfig } from '../server/users.js'
import { importConsultants, prepareConsultantImport } from '../server/consultants.js'

let client
try {
  const path = process.argv[2]
  if (!path || process.argv.length !== 3) throw new Error('JSON 경로 또는 - 가 필요합니다.')
  let json
  if (path === '-') {
    const chunks = []
    let size = 0
    for await (const chunk of process.stdin) {
      size += chunk.length
      if (size > 8 * 1024 * 1024) throw new Error('입력이 너무 큽니다.')
      chunks.push(chunk)
    }
    json = Buffer.concat(chunks).toString('utf8')
  } else {
    json = await readFile(path, 'utf8')
  }
  const consultants = prepareConsultantImport(JSON.parse(json))
  const connection = await connectDatabase(cliDatabaseConfig())
  client = connection.client
  const imported = await importConsultants(connection.db.collection('consultants'), consultants)
  console.log(`상담사 초기 가져오기 완료: ${imported}명`)
} catch {
  // Error objects can contain connection strings, file paths, or input values.
  console.error('상담사 초기 가져오기에 실패했습니다. 입력 형식과 DB 연결 및 기존 데이터 유무를 확인하세요.')
  process.exitCode = 1
} finally {
  await client?.close()
}
