import { configureMeetingRuntime } from '../../shared/ui/runtime'
import { createWebRuntime } from './runtime'

configureMeetingRuntime(createWebRuntime())
void import('../../shared/ui/mount').then(({ mountMeetingApp }) => mountMeetingApp())
