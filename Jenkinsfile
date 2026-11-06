// Loaded by the manual-only checkout job inside its assigned node/workspace.
properties([
  pipelineTriggers([]),
  disableConcurrentBuilds(),
  buildDiscarder(logRotator(numToKeepStr: '20')),
  parameters([
    booleanParam(name: 'VERIFY_ONLY', defaultValue: false,
      description: '검증과 읽기 전용 배포 설정 확인만 수행합니다. 운영 배포는 건너뜁니다.')
  ])
])

try {
  stage('Verify') {
    sh 'bash ./scripts/jenkins-deploy.sh verify'
  }
  stage('Preflight') {
    withCredentials([
      file(credentialsId: 'consulting-manager-runtime-env', variable: 'RUNTIME_ENV'),
      file(credentialsId: 'firebase-consulting-deploy', variable: 'FIREBASE_TOKEN_FILE')
    ]) {
      sh 'bash ./scripts/jenkins-deploy.sh preflight'
      sh 'bash ./scripts/jenkins-deploy.sh firebase-check'
      sh 'bash ./scripts/jenkins-deploy.sh check'
    }
  }
  if (params.VERIFY_ONLY) {
    echo '검증 완료: VERIFY_ONLY 설정으로 Docker와 Hosting 운영 배포를 건너뛰었습니다.'
  } else {
    stage('Build Images') {
      sh 'bash ./scripts/jenkins-deploy.sh build'
    }
    stage('Deploy API') {
      withCredentials([
        file(credentialsId: 'consulting-manager-runtime-env', variable: 'RUNTIME_ENV')
      ]) {
        sh 'bash ./scripts/jenkins-deploy.sh deploy'
      }
    }
    stage('Public API') {
      sh 'bash ./scripts/jenkins-deploy.sh check'
    }
    stage('Firebase Hosting') {
      withCredentials([
        file(credentialsId: 'firebase-consulting-deploy', variable: 'FIREBASE_TOKEN_FILE')
      ]) {
        sh 'bash ./scripts/jenkins-deploy.sh firebase'
      }
    }
    echo 'MacBook Pro Docker API 및 y2-consulting Hosting 배포 완료'
  }
} finally {
  sh 'bash ./scripts/jenkins-deploy.sh cleanup'
  deleteDir()
}
