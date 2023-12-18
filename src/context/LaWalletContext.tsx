import SpinnerView from '@/components/Loader/SpinnerView'
import { Alert } from '@/components/UI'
import { STORAGE_IDENTITY_KEY } from '@/constants/constants'
import { useActivity } from '@/hooks/useActivity'
import useAlert, { UseAlertReturns } from '@/hooks/useAlerts'
import useConfiguration, { ConfigReturns } from '@/hooks/useConfiguration'
import useCurrencyConverter, {
  UseConverterReturns
} from '@/hooks/useCurrencyConverter'
import { useTokenBalance } from '@/hooks/useTokenBalance'
import { getUsername } from '@/interceptors/identity'
import { parseContent } from '@/lib/utils'
import { TokenBalance } from '@/types/balance'
import { UserIdentity, defaultIdentity } from '@/types/identity'
import { Transaction, TransactionDirection } from '@/types/transaction'
import { differenceInSeconds } from 'date-fns'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { getPublicKey } from 'nostr-tools'
import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useState
} from 'react'

interface LaWalletContextType {
  identity: UserIdentity
  setUserIdentity: (new_identity: UserIdentity) => Promise<void>
  balance: TokenBalance
  sortedTransactions: Transaction[]
  userConfig: ConfigReturns
  notifications: UseAlertReturns
  converter: UseConverterReturns
}

const loggedRoutes: string[] = [
  'dashboard',
  'transfer',
  'transferamount',
  'transferfinish',
  'transfersummary',
  'transfererror',
  'deposit',
  'scan',
  'settings',
  'transactions',
  'card',
  'voucher',
  'voucherfinish'
]

const unloggedRoutes: string[] = ['', 'start', 'login', 'reset']

export const LaWalletContext = createContext({} as LaWalletContextType)

export function LaWalletProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState<boolean>(false)
  const [identity, setIdentity] = useState<UserIdentity>(defaultIdentity)

  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const notifications = useAlert()

  const { activityInfo, sortedTransactions, resetActivity } = useActivity({
    pubkey: identity.hexpub,
    enabled: Boolean(identity.hexpub.length)
  })

  const userConfig: ConfigReturns = useConfiguration()
  const converter = useCurrencyConverter()

  const { balance } = useTokenBalance({
    pubkey: identity.hexpub,
    tokenId: 'BTC'
  })

  const preloadIdentity = async () => {
    const storageIdentity = localStorage.getItem(STORAGE_IDENTITY_KEY)

    if (storageIdentity) {
      const userIdentity: UserIdentity = parseContent(storageIdentity)

      if (userIdentity.privateKey) {
        const hexpub: string = getPublicKey(userIdentity.privateKey)
        const username: string = await getUsername(hexpub)

        if (
          hexpub === userIdentity.hexpub &&
          username == userIdentity.username
        ) {
          setIdentity(userIdentity)
        } else {
          setIdentity({
            ...userIdentity,
            hexpub,
            username
          })
        }
      }
    }

    setHydrated(true)
    return
  }

  const setUserIdentity = async (new_identity: UserIdentity) => {
    resetActivity()

    setIdentity(new_identity)
    localStorage.setItem(STORAGE_IDENTITY_KEY, JSON.stringify(new_identity))
    return
  }

  const notifyReceivedTransaction = () => {
    const new_transactions: Transaction[] = sortedTransactions.filter(tx => {
      const transactionId: string = tx.id
      return Boolean(!activityInfo.idsLoaded.includes(transactionId))
    })

    if (
      new_transactions.length &&
      new_transactions[0].direction === TransactionDirection.INCOMING
    ) {
      const secondsSinceCreated: number = differenceInSeconds(
        new Date(),
        new Date(new_transactions[0].createdAt)
      )

      if (secondsSinceCreated < 15)
        notifications.showAlert({
          description: 'TRANSACTION_RECEIVED',
          type: 'success',
          params: {
            sats: (new_transactions[0].tokens.BTC / 1000).toString()
          }
        })
    }
  }

  useEffect(() => {
    preloadIdentity()
  }, [])

  useEffect(() => {
    if (sortedTransactions.length) notifyReceivedTransaction()
  }, [sortedTransactions.length])

  useLayoutEffect(() => {
    if (hydrated) {
      const cleanedPath: string = pathname.replace(/\//g, '').toLowerCase()
      const userLogged: boolean = Boolean(identity.hexpub.length)
      const nonce: string = params.get('i') || ''
      const card: string = params.get('c') || ''

      switch (true) {
        case !userLogged && pathname == '/' && !nonce:
          router.push('/')
          break

        case !userLogged && loggedRoutes.includes(cleanedPath):
          router.push('/')
          break

        case userLogged && unloggedRoutes.includes(cleanedPath):
          card
            ? router.push(`/settings/cards?c=${card}`)
            : router.push('/dashboard')
          break
      }
    }
  }, [pathname, identity, hydrated])

  const value = {
    identity,
    setUserIdentity,
    balance,
    sortedTransactions,
    userConfig,
    notifications,
    converter
  }

  return (
    <LaWalletContext.Provider value={value}>
      <Alert
        title={notifications.alert?.title}
        description={notifications.alert?.description}
        type={notifications.alert?.type}
        isOpen={!!notifications.alert}
        params={notifications.alert?.params}
      />

      {!hydrated ? <SpinnerView /> : children}
    </LaWalletContext.Provider>
  )
}

export const useLaWalletContext = () => {
  const context = useContext(LaWalletContext)
  if (!context) {
    throw new Error('useLaWalletContext must be used within LaWalletProvider')
  }

  return context
}
