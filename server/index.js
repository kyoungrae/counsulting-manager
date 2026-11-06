import { createApp } from './app.js'
import { loadConfig } from './config.js'
import { connectDatabase } from './db.js'

try {
  const config = loadConfig()
  const { client, db } = await connectDatabase(config)
  const app = createApp({ db, config })
  const server = app.listen(config.port, config.host, () => console.log(`컨설팅 서버 실행: ${config.port}`))
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.once(signal, () => {
      const timeout = setTimeout(() => process.exit(1), 10000).unref()
      server.close(async () => {
        await client.close()
        clearTimeout(timeout)
        process.exit(0)
      })
    })
  }
} catch (error) {
  console.error('서버 시작 실패:', error.name, error.name === 'Error' ? error.message : 'MongoDB 접속 설정과 컨테이너 상태를 확인하세요.')
  process.exitCode = 1
}
