import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { delimiter, isAbsolute, join } from 'node:path'

interface ExecutableSearch {
  displayName: string
  binaryName: string
  cliName?: string
  extraDirectories?: string[]
}

// Honors an explicit absolute path; otherwise searches PATH and the usual install locations.
export const resolveLocalExecutable = (configured: string, { displayName, binaryName, cliName = `${displayName} CLI`, extraDirectories = [] }: ExecutableSearch) => {
  const explicit = configured.trim()
  if (explicit) {
    if (!isAbsolute(explicit) || !existsSync(explicit)) {
      throw new Error(`${displayName} 路径必须是已存在的可执行文件的绝对路径。`)
    }
    return explicit
  }

  const name = process.platform === 'win32' ? `${binaryName}.exe` : binaryName
  const directories = [
    ...(process.env.PATH ?? '').split(delimiter),
    join(homedir(), '.local', 'bin'), '/opt/homebrew/bin', '/usr/local/bin',
    ...extraDirectories,
  ].filter(Boolean)
  for (const directory of directories) {
    const candidate = join(directory, name)
    if (existsSync(candidate)) return candidate
  }
  throw new Error(`未找到 ${cliName}。请先安装并登录，或在设置中填写可执行文件路径。`)
}
