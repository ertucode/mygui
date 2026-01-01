import { directoryStore } from '../directoryStore/directory'
import { vimStore } from './vimStore'

/*
 * FIRST WRITE DOWN HOW IT WILL WORK
 *
 * */
export function setupVimSubscriptions() {
  const s = directoryStore.on('directoryCreated', o => {
    vimStore.trigger.initVimState({
      directoryId: o.directoryId,
      state: {
        buffers: {},
        count: 0,
        currentBuffer: {},
      },
    })
  })

  return s.unsubscribe
}
