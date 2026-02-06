import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

const SRC_DIR = path.join(process.cwd(), 'src')
const LOG_FILE = path.join(process.cwd(), 'discordllmbot.log')

function timestamp() {
  return new Date().toISOString()
}

function appendLog(message) {
  try {
    fs.appendFileSync(LOG_FILE, `[${timestamp()}] [INFO] ${message}\n`, 'utf8')
  } catch (e) {
    console.error('Failed to write restart marker to log:', e.message)
  }
}

let child = null
let restarting = false

function startChild() {
  child = spawn(process.execPath, ['src/index.js'], {
    stdio: 'inherit',
    env: process.env
  })

  child.on('exit', (code, signal) => {
    console.log(`Child exited with code=${code} signal=${signal}`)
    if (!restarting) {
      // If child exited on its own, we wait a moment and restart
      setTimeout(() => startChild(), 1000)
    }
  })
}

function restartChild(changedFile) {
  if (!child) return
  if (restarting) return
  restarting = true

  const msg = `Dev watcher: Restarting server due to change in ${changedFile}`
  console.log(msg)
  appendLog(msg)

  try {
    child.kill()
  } catch (e) {
    console.error('Failed to kill child process:', e.message)
  }

  // Give it a small moment to exit
  setTimeout(() => {
    restarting = false
    startChild()
    const msg2 = `Dev watcher: Server restarted`;
    console.log(msg2)
    appendLog(msg2)
  }, 300)
}

// Start initial child
startChild()

// Watch for changes in src/ (recursive watch works on Windows and macOS)
let debounce = null
try {
  const watcher = fs.watch(SRC_DIR, { recursive: true }, (eventType, filename) => {
    if (!filename) return
    // Debounce rapid events
    if (debounce) clearTimeout(debounce)
    debounce = setTimeout(() => {
      restartChild(filename)
    }, 200)
  })

  process.on('SIGINT', () => {
    console.log('Dev watcher exiting...')
    watcher.close()
    if (child) child.kill()
    process.exit(0)
  })
} catch (e) {
  console.error('Failed to start file watcher. You can restart manually with `npm start`', e.message)
}
