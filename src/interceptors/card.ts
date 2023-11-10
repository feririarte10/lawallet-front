import { LAWALLET_ENDPOINT } from '@/constants/config'
import { NostrEvent } from '@nostr-dev-kit/ndk'

export const requestCardActivation = async (
  event: NostrEvent
): Promise<boolean> => {
  return fetch(`${LAWALLET_ENDPOINT}/card`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(event)
  })
    .then(res => {
      return res.status === 200 || res.status === 204
    })
    .catch(() => {
      return false
    })
}

export const cardResetCaim = async (
  event: NostrEvent
): Promise<Record<'name' | 'error', string>> => {
  return fetch(`${LAWALLET_ENDPOINT}/card/reset/claim`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(event)
  })
    .then(res => res.json())
    .catch(() => {
      return { error: 'ERROR_ON_RESET_ACCOUNT' }
    })
}
