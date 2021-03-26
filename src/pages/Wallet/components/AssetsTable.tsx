import React, { useCallback, useState, useMemo, useEffect } from 'react';
import styled from 'styled-components';
import { Theme, useTheme } from '@material-ui/core';

import { Row, RowContainer, Title, VioletButton } from '../../commonStyles';

import TokenIcon from '../../../components/TokenIcon';
import {
  refreshWalletPublicKeys,
  useBalanceInfo,
  useWallet,
  useWalletPublicKeys,
} from '../../../utils/wallet';

import {
  refreshAccountInfo,
  useConnection,
  useSolanaExplorerUrlSuffix,
} from '../../../utils/connection';
import { formatNumberToUSFormat, stripDigitPlaces } from '../../../utils/utils';
import { BtnCustom } from '../../../components/BtnCustom';

import AddIcon from '../../../images/addIcon.svg';
import RefreshIcon from '../../../images/refresh.svg';
import ReceiveIcon from '../../../images/receive.svg';
import SendIcon from '../../../images/send.svg';
import ExplorerIcon from '../../../images/explorer.svg';
import { MarketsDataSingleton } from '../../../components/MarketsDataSingleton';
import { priceStore, serumMarkets } from '../../../utils/markets';

export const TableContainer = styled(({ theme, ...props }) => (
  <Row {...props} />
))`
  background: ${(props) => props.theme.customPalette.grey.background};
  border: ${(props) => props.theme.customPalette.border.new};
  border-radius: 1.2rem;
  height: 100%;
`;

const StyledTable = styled.table`
  width: calc(100% - 4.8rem);
  margin: 0 2.4rem;
  border-spacing: 0;

  & tr td:first-child {
    border-bottom-left-radius: 1.2rem;
    border-top-left-radius: 1.2rem;
  }

  & tr td:last-child {
    border-top-right-radius: 1.2rem;
    border-bottom-right-radius: 1.2rem;
  }

  & tr td:first-child {
    padding-left: 2.4rem;
  }

  & tr td:last-child {
    padding-right: 2.4rem;
  }
`;

export const HeadRow = styled(Row)`
  text-align: right;
  width: 10%;
  border-bottom: ${(props) => props.theme.customPalette.border.new};
`;

const AddTokenButton = ({
  theme,
  setShowAddTokenDialog,
}: {
  theme: Theme;
  setShowAddTokenDialog: (isOpen: boolean) => void;
}) => {
  return (
    <BtnCustom
      textTransform={'capitalize'}
      borderWidth="0"
      height={'100%'}
      padding={'1.2rem 0'}
      onClick={() => setShowAddTokenDialog(true)}
    >
      <img src={AddIcon} alt="addIcon" style={{ marginRight: '1rem' }} />
      <GreyTitle theme={theme}>Add token</GreyTitle>
    </BtnCustom>
  );
};

export const GreyTitle = styled(({ theme, ...props }) => (
  <Title
    color={theme.customPalette.grey.light}
    fontFamily="Avenir Next Demi"
    fontSize="1.4rem"
    {...props}
  />
))`
  white-space: nowrap;
`;

const StyledTr = styled.tr`
  height: 7rem;

  &:nth-child(2n) td {
    background: ${(props) =>
      props.disableHover ? '' : props.theme.customPalette.dark.background};
  }
`;

const StyledTd = styled.td`
  padding-top: 1rem;
  padding-bottom: 1rem;
`;

const AssetSymbol = styled(Title)`
  font-size: 2rem;
  font-family: Avenir Next Demi;
`;

const AssetName = styled(Title)`
  color: ${(props) => props.theme.customPalette.grey.light};
  font-size: 1.4rem;
  font-family: Avenir Next;
  margin-left: 0.5rem;
`;

const AssetAmount = styled(Title)`
  color: ${(props) => props.theme.customPalette.green.light};
  font-size: 1.4rem;
  font-family: Avenir Next;
`;

const AssetAmountUSD = styled(AssetAmount)`
  font-family: Avenir Next Demi;
`;

// Aggregated $USD values of all child BalanceListItems child components.
//
// Values:
// * undefined => loading.
// * null => no market exists.
// * float => done.
//
// For a given set of publicKeys, we know all the USD values have been loaded when
// all of their values in this object are not `undefined`.
export const usdValues: any = {};

export const totalUsdValue = Object.values(usdValues);

// Calculating associated token addresses is an asynchronous operation, so we cache
// the values so that we can quickly render components using them. This prevents
// flickering for the associated token fingerprint icon.
export const associatedTokensCache = {};

export function pairsIsLoaded(publicKeys, usdValues) {
  return (
    publicKeys.filter((pk) => usdValues[pk.toString()] !== undefined).length ===
    publicKeys.length
  );
}

const AssetsTable = ({
  selectPublicKey,
  setSendDialogOpen,
  setDepositDialogOpen,
  setShowAddTokenDialog,
}: {
  selectPublicKey: (publicKey: any) => void;
  setSendDialogOpen: (isOpen: boolean) => void;
  setDepositDialogOpen: (isOpen: boolean) => void;
  setShowAddTokenDialog: (isOpen: boolean) => void;
}) => {
  const theme = useTheme();
  const wallet = useWallet();
  const [, setTotalUSD] = useState(0);

  const [marketsData, setMarketsData] = useState<any>(null);
  const [forceUpdateConter, setForceUpdateCounter] = useState(0);

  useEffect(() => {
    console.log('forceUpdateCounter')
    setForceUpdateCounter(forceUpdateConter + 1);
  }, [MarketsDataSingleton.forceUpdateCounter]);

  console.log('rerender of table');

  const [
    publicKeys,
    // loaded
  ] = useWalletPublicKeys();

  useEffect(() => {
    const getData = async () => {
      const data = await MarketsDataSingleton.getData();
      setMarketsData(data);
    };

    getData();
  }, []);

  // const { accounts, setAccountName } = useWalletSelector();

  // Dummy var to force rerenders on demand.

  const sortedPublicKeys = useMemo(
    () =>
      Array.isArray(publicKeys)
        ? [...publicKeys].sort((a, b) => {
            const aVal = usdValues[a.toString()];
            const bVal = usdValues[b.toString()];

            // SOL always fisrt
            if (a.equals(wallet.publicKey)) return -1;
            if (b.equals(wallet.publicKey)) return 1;

            a = aVal === undefined || aVal === null ? -1 : aVal;
            b = bVal === undefined || bVal === null ? -1 : bVal;

            if (b < a) {
              return -1;
            } else if (b > a) {
              return 1;
            } else {
              return 0;
            }
          })
        : [],
    [publicKeys, wallet.publicKey],
  );

  // const selectedAccount = accounts.find((a) => a.isSelected);
  // const allTokensLoaded = loaded && fairsIsLoaded(publicKeys);

  // Memoized callback and component for the `BalanceListItems`.
  //
  // The `BalancesList` fetches data, e.g., fairs for tokens using React hooks
  // in each of the child `BalanceListItem` components. However, we want the
  // parent component, to aggregate all of this data together, for example,
  // to show the cumulative USD amount in the wallet.
  //
  // To achieve this, we need to pass a callback from the parent to the chlid,
  // so that the parent can collect the results of all the async network requests.
  // However, this can cause a render loop, since invoking the callback can cause
  // the parent to rerender, which causese the child to rerender, which causes
  // the callback to be invoked.
  //
  // To solve this, we memoize all the `BalanceListItem` children components

  const setUsdValuesCallback = useCallback(
    (publicKey, usdValue) => {
      usdValues[publicKey.toString()] = usdValue;
      if (pairsIsLoaded(sortedPublicKeys, usdValues)) {
        const totalUsdValue: any = sortedPublicKeys
          .filter((pk) => usdValues[pk.toString()])
          .map((pk) => usdValues[pk.toString()])
          .reduce((a, b) => a + b, 0.0);

        setTotalUSD(totalUsdValue);
      }
    },
    [sortedPublicKeys],
  );

  const memoizedAssetsList = useMemo(() => {
    return sortedPublicKeys.map((pk) => {
      return React.memo((props) => {
        return (
          <AssetItem
            key={`${pk.toString()}-table`}
            publicKey={pk}
            theme={theme}
            marketsData={marketsData}
            setUsdValue={setUsdValuesCallback}
            selectPublicKey={selectPublicKey}
            setSendDialogOpen={setSendDialogOpen}
            setDepositDialogOpen={setDepositDialogOpen}
          />
        );
      });
    });
  }, [
    sortedPublicKeys,
    setUsdValuesCallback,
    theme,
    marketsData,
    selectPublicKey,
    setSendDialogOpen,
    setDepositDialogOpen,
  ]);

  return (
    <TableContainer
      theme={theme}
      width="calc(85% - 1rem)"
      direction="column"
      justify={'flex-start'}
    >
      <RowContainer height="5rem" theme={theme}>
        <HeadRow
          theme={theme}
          justify="flex-start"
          style={{ width: '80%', padding: '1.4rem 0 1.4rem 2.4rem' }}
        >
          <GreyTitle theme={theme}>Assets</GreyTitle>
        </HeadRow>
        <HeadRow theme={theme}>
          <AddTokenButton
            setShowAddTokenDialog={setShowAddTokenDialog}
            theme={theme}
          />
        </HeadRow>
        <HeadRow theme={theme}>
          <BtnCustom
            textTransform={'capitalize'}
            borderWidth="0"
            height={'100%'}
            padding={'1.2rem 0'}
            onClick={() => {
              try {
                refreshWalletPublicKeys(wallet);
                sortedPublicKeys.forEach((publicKey) => {
                  refreshAccountInfo(wallet.connection, publicKey, true);
                });
              } catch (e) {
                console.error(e);
              }
            }}
          >
            <img
              src={RefreshIcon}
              alt="refreshIcon"
              style={{ marginRight: '1rem' }}
            />
            <GreyTitle theme={theme}>Refresh</GreyTitle>
          </BtnCustom>
        </HeadRow>
      </RowContainer>
      <RowContainer
        style={{ display: 'block', overflowY: 'auto' }}
        height="calc(100% - 5rem)"
      >
        <StyledTable theme={theme}>
          {memoizedAssetsList.map((MemoizedAsset, i) => (
            <MemoizedAsset />
          ))}
          <StyledTr disableHover theme={theme}>
            <StyledTd style={{ paddingLeft: '0' }}>
              <RowContainer
                width="14rem"
                justify="flex-start"
                style={{ height: '5rem', paddingLeft: '2rem' }}
              >
                <AddTokenButton
                  setShowAddTokenDialog={setShowAddTokenDialog}
                  theme={theme}
                />
              </RowContainer>
            </StyledTd>
          </StyledTr>
        </StyledTable>
      </RowContainer>
    </TableContainer>
  );
};

const AssetItem = ({
  publicKey,
  setUsdValue,
  theme,
  marketsData = new Map(),
  selectPublicKey,
  setSendDialogOpen,
  setDepositDialogOpen,
}: {
  publicKey: any;
  theme: Theme;
  marketsData: any;
  setUsdValue: (publicKey: any, usdValue: null | number) => void;
  selectPublicKey: (publicKey: any) => void;
  setSendDialogOpen: (isOpen: boolean) => void;
  setDepositDialogOpen: (isOpen: boolean) => void;
}) => {
  const balanceInfo = useBalanceInfo(publicKey);
  const urlSuffix = useSolanaExplorerUrlSuffix();
  const connection = useConnection();

  let {
    amount,
    decimals,
    mint,
    tokenName,
    tokenSymbol,
    tokenLogoUri,
  } = balanceInfo || {
    amount: 0,
    decimals: 8,
    mint: null,
    tokenName: 'Loading...',
    tokenSymbol: '',
    tokenLogoUri: '',
  };

  const quote = !!marketsData
    ? marketsData.has(`${tokenSymbol?.toUpperCase()}_USDT`)
      ? 'USDT'
      : marketsData.has(`${tokenSymbol?.toUpperCase()}_USDC`)
      ? 'USDC'
      : 'USDT'
    : 'USDT';

  const symbol = `${tokenSymbol}_${quote}`;

  const price = MarketsDataSingleton.getDataBySymbol(symbol)?.closePrice || 0;

  const formattedAmount = amount / Math.pow(10, decimals);

  useEffect(() => {
    if (tokenSymbol) {
      const coin = tokenSymbol.toUpperCase();

      // Don't fetch USD stable coins. Mark to 1 USD.
      if (
        coin === 'USDT' ||
        coin === 'USDC' ||
        coin === 'WUSDC' ||
        coin === 'WUSDT'
      ) {
        if (
          !MarketsDataSingleton.getDataBySymbol(symbol)?.dataFromBonfidaLoaded
        ) {
          MarketsDataSingleton.setDataBySymbol(symbol, 1, formattedAmount);
        }
      }
      // A Serum market exists. Fetch the price.
      else if (
        serumMarkets[coin] &&
        !MarketsDataSingleton.getDataBySymbol(symbol)?.dataFromBonfidaLoaded
      ) {
        let m = serumMarkets[coin];

        priceStore
          .getPrice(connection, m.name)
          .then((price) => {
            MarketsDataSingleton.setDataBySymbol(
              symbol,
              price || 0,
              formattedAmount,
            );
          })
          .catch((err) => {
            console.error(err);
            MarketsDataSingleton.setDataBySymbol(symbol, null, 0);
          });
      }
    }
  }, [tokenSymbol, connection]);

  // set amount on load or change
  useEffect(() => {
    console.log('symbol', symbol, amount, decimals);
    const formattedAmount = amount / Math.pow(10, decimals);

    if (
      !amount ||
      !decimals ||
      ! MarketsDataSingleton.getDataBySymbol(symbol) ||
      MarketsDataSingleton.getDataBySymbol(symbol).amount === formattedAmount
    )
      return;

    MarketsDataSingleton.setDataBySymbol(symbol, null, formattedAmount);
  }, [amount, decimals, symbol]);

  let { lastPriceDiff } = (!!marketsData &&
    (marketsData.get(`${tokenSymbol?.toUpperCase()}_USDT`) ||
      marketsData.get(`${tokenSymbol?.toUpperCase()}_USDC`))) || {
    closePrice: 0,
    lastPriceDiff: 0,
  };

  const prevClosePrice = price - lastPriceDiff;

  const priceChangePercentage = !!price
    ? !!prevClosePrice
      ? (price - prevClosePrice) / (prevClosePrice / 100)
      : 100
    : 0;

  const sign24hChange =
    +priceChangePercentage === 0 ? '' : +priceChangePercentage > 0 ? `+` : `-`;

  const color =
    +priceChangePercentage === 0
      ? '#ecf0f3'
      : +priceChangePercentage > 0
      ? theme.customPalette.green.light
      : theme.customPalette.red.main;

  // const usdValue =
  //   price === undefined // Not yet loaded.
  //     ? undefined
  //     : price === null // Loaded and empty.
  //     ? null
  //     : +(formattedAmount * price).toFixed(2); // Loaded.

  // console.log(
  //   'tokenSymbol',
  //   tokenSymbol,
  //   usdValue,
  //   price,
  //   priceForCalculate,
  //   amount,
  //   decimals,
  // );

  // useEffect(() => {
  //   if (usdValue !== undefined) {
  //     // console.log('setUsdValue', tokenSymbol)
  //     setUsdValue(publicKey, usdValue === null ? null : usdValue);
  //   }
  // }, [usdValue]);

  console.log('token', tokenSymbol, price, formattedAmount);

  return (
    <StyledTr theme={theme}>
      <StyledTd>
        <RowContainer justify="flex-start">
          <Row margin="0 1rem 0 0">
            <TokenIcon
              mint={mint}
              tokenLogoUri={tokenLogoUri}
              tokenName={tokenName}
              size={'3.6rem'}
            />
          </Row>
          <Row direction="column">
            <RowContainer justify="flex-start">
              <AssetSymbol>
                {tokenSymbol && tokenSymbol.length > 16
                  ? tokenSymbol.slice(0, 16) + '...'
                  : tokenSymbol}
              </AssetSymbol>
              <AssetName theme={theme}>
                {tokenName && tokenName.length > 32
                  ? tokenName.slice(0, 32) + '...'
                  : tokenName}
              </AssetName>
            </RowContainer>
            <RowContainer justify="flex-start">
              <AssetAmount theme={theme}>{`${stripDigitPlaces(
                formattedAmount,
                8,
              )} ${tokenSymbol} / `}</AssetAmount>
              &ensp;
              <AssetAmountUSD theme={theme}>{` $${stripDigitPlaces(
                formattedAmount * price || 0,
                2,
              )} `}</AssetAmountUSD>
            </RowContainer>
          </Row>
        </RowContainer>
      </StyledTd>
      <StyledTd>
        <RowContainer direction="column" align="flex-start">
          <GreyTitle theme={theme}>P&L 24h:</GreyTitle>
          <Title fontSize="1.4rem" fontFamily="Avenir Next Demi">
            Soon
          </Title>
        </RowContainer>
      </StyledTd>
      <StyledTd>
        <RowContainer direction="column" align="flex-start">
          <GreyTitle theme={theme}>Price</GreyTitle>
          <Title fontSize="1.4rem" fontFamily="Avenir Next Demi">
            $
            {formatNumberToUSFormat(
              stripDigitPlaces(price || 0, price < 1 ? 8 : 2),
            )}
          </Title>
        </RowContainer>
      </StyledTd>

      <StyledTd>
        <RowContainer direction="column" align="flex-start">
          <GreyTitle theme={theme}>Change 24h:</GreyTitle>
          <RowContainer justify="flex-start">
            <Title fontSize="1.4rem" color={color}>
              {!priceChangePercentage
                ? '0%'
                : `${sign24hChange}${formatNumberToUSFormat(
                    stripDigitPlaces(Math.abs(priceChangePercentage), 2),
                  )}% `}
              &nbsp;
            </Title>
            <Title fontSize="1.4rem">/</Title>&nbsp;
            <Title
              color={color}
              fontSize="1.4rem"
              fontFamily="Avenir Next Demi"
            >
              {` ${sign24hChange}$${formatNumberToUSFormat(
                stripDigitPlaces(Math.abs(lastPriceDiff), 2),
              )}`}
            </Title>
          </RowContainer>
        </RowContainer>
      </StyledTd>
      <StyledTd>
        <RowContainer justify="flex-end">
          <VioletButton
            theme={theme}
            height="50%"
            width="10rem"
            background={'linear-gradient(135deg, #A5E898 0%, #97E873 100%)'}
            color={theme.customPalette.dark.background}
            margin="0 2rem 0 0"
            onClick={() => {
              selectPublicKey(publicKey);
              setDepositDialogOpen(true);
            }}
          >
            <img
              src={ReceiveIcon}
              alt="receive"
              style={{ marginRight: '.5rem' }}
            />
            <span>Receive</span>
          </VioletButton>

          <VioletButton
            theme={theme}
            height="50%"
            width="7rem"
            background={
              'linear-gradient(140.41deg, #F26D68 0%, #F69894 92.17%)'
            }
            margin="0 2rem 0 0"
            onClick={() => {
              selectPublicKey(publicKey);
              setSendDialogOpen(true);
            }}
          >
            <img src={SendIcon} alt="send" style={{ marginRight: '.5rem' }} />
            Send
          </VioletButton>

          <VioletButton
            theme={theme}
            component="a"
            target="_blank"
            rel="noopener"
            href={
              `https://explorer.solana.com/account/${publicKey.toBase58()}` +
              urlSuffix
            }
            height="50%"
            width="14rem"
            margin="0 2rem 0 0"
          >
            <img
              src={ExplorerIcon}
              alt="Explorer Icon"
              style={{ marginRight: '.5rem' }}
            />
            View Explorer
          </VioletButton>
          <VioletButton
            theme={theme}
            component="a"
            target="_blank"
            disabled={
              !marketsData ||
              !marketsData.has(`${tokenSymbol?.toUpperCase()}_USDC`) ||
              !marketsData.has(`${tokenSymbol?.toUpperCase()}_USDT`)
            }
            rel="noopener"
            href={`https://dex.cryptocurrencies.ai/chart/spot/${tokenSymbol?.toUpperCase()}_${quote}#connect_wallet`}
            height="50%"
            width="7rem"
            margin="0 2rem 0 0"
          >
            Trade
          </VioletButton>

          {/* <VioletButton
            theme={theme}
            height="50%"
            width="7rem"
            margin="0 2rem 0 0"
          >
            Swap
          </VioletButton> */}
        </RowContainer>
      </StyledTd>
    </StyledTr>
  );
};

export default AssetsTable;
