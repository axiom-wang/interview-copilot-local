import { configureMeetingRuntime } from '../../../shared/ui/runtime'
import { createDesktopRuntime } from './runtime'

configureMeetingRuntime(createDesktopRuntime())
void import('../../../shared/ui/mount').then(({ mountMeetingApp }) => mountMeetingApp())
