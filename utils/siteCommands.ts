export interface SiteCommand {
  id: string
  site_id: string
  command: string
  status: 'pending' | 'running' | 'finished' | 'failed'
  output?: string
  user?: {
    id: string
    name: string
  }
  created_at: string
}

export interface SiteCommandEventData {
  site_id?: string
  command?: SiteCommand
}

export const reconcileCommandUpdate = (
  commands: SiteCommand[],
  data: SiteCommandEventData,
  siteId: string,
) => {
  if (data.site_id !== siteId || !data.command) return commands

  const updatedCommand = data.command
  const commandIndex = commands.findIndex(
    (command) => command.id === updatedCommand.id,
  )
  if (commandIndex < 0) return [updatedCommand, ...commands]

  return commands.map((command, index) =>
    index === commandIndex ? updatedCommand : command,
  )
}
