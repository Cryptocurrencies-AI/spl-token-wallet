import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import styled from 'styled-components';
import { Redirect } from 'react-router-dom'
import { useWallet, useWalletPublicKeys } from '../../utils/wallet';
import { decodeMessage } from '../../utils/transactions';
import { useConnection, useSolanaExplorerUrlSuffix } from '../../utils/connection';
import { Divider, Checkbox, Typography, useTheme } from '@material-ui/core';
import CircularProgress from '@material-ui/core/CircularProgress';
import Box from '@material-ui/core/Box';
import Card from '@material-ui/core/Card';
import CardContent from '@material-ui/core/CardContent';
import CardActions from '@material-ui/core/CardActions';
import ImportExportIcon from '../../images/importExxcportIcon.svg';
import Logo from '../../images/logo.svg';
import { makeStyles } from '@material-ui/core/styles';
import assert from 'assert';
import bs58 from 'bs58';
import NewOrder from '../../components/instructions/NewOrder';
import UnknownInstruction from '../../components/instructions/UnknownInstruction';
import SystemInstruction from '../../components/instructions/SystemInstruction';
import DexInstruction from '../../components/instructions/DexInstruction';
import TokenInstruction from '../../components/instructions/TokenInstruction';
import { BtnCustom } from '../../components/BtnCustom';
import { Row, RowContainer, StyledLabel, VioletButton, WhiteButton, ExclamationMark } from '../commonStyles';

const StyledCard = styled(Card)`
  background: #17181a;
  color: #ecf0f3;
  text-align: center;
  width: 39rem;
  padding: 3rem;
  margin: 0 auto;
  box-shadow: none;
`;

export default function PopupPage({ opener }) {
  const wallet = useWallet();

  const origin = useMemo(() => {
    let params = new URLSearchParams(window.location.hash.slice(1));
    return params.get('origin');
  }, []);
  const postMessage = useCallback(
    (message) => {
      opener.postMessage({ jsonrpc: '2.0', ...message }, origin);
    },
    [opener, origin],
  );

  const [connectedAccount, setConnectedAccount] = useState(null);
  const hasConnectedAccount = !!connectedAccount;
  const [requests, setRequests] = useState([]);
  const [autoApprove, setAutoApprove] = useState(false);

  // Send a disconnect event if this window is closed, this component is
  // unmounted, or setConnectedAccount(null) is called.
  useEffect(() => {
    if (hasConnectedAccount) {
      function unloadHandler() {
        postMessage({ method: 'disconnected' });
      }
      window.addEventListener('beforeunload', unloadHandler);
      return () => {
        unloadHandler();
        window.removeEventListener('beforeunload', unloadHandler);
      };
    }
  }, [hasConnectedAccount, postMessage]);

  // Disconnect if the user switches to a different wallet.
  useEffect(() => {
    if (connectedAccount && !connectedAccount.equals(wallet.publicKey)) {
      setConnectedAccount(null);
    }
  }, [connectedAccount, wallet]);

  // Push requests from the parent window into a queue.
  useEffect(() => {
    function messageHandler(e) {
      if (e.origin === origin && e.source === window.opener) {
        if (
          e.data.method !== 'signTransaction' &&
          e.data.method !== 'signAllTransactions'
        ) {
          postMessage({ error: 'Unsupported method', id: e.data.id });
        }

        setRequests((requests) => [...requests, e.data]);
      }
    }
    window.addEventListener('message', messageHandler);
    return () => window.removeEventListener('message', messageHandler);
  }, [origin, postMessage]);

  if (!connectedAccount || !connectedAccount.equals(wallet.publicKey)) {
    // Approve the parent page to connect to this wallet.
    function connect(autoApprove) {
      setConnectedAccount(wallet.publicKey);
      postMessage({
        method: 'connected',
        params: { publicKey: wallet.publicKey.toBase58(), autoApprove },
      });
      setAutoApprove(autoApprove);
      focusParent();
    }

    return <ApproveConnectionForm origin={origin} onApprove={connect} />;
  }

  if (requests.length > 0) {
    const request = requests[0];
    assert(
      request.method === 'signTransaction' ||
        request.method === 'signAllTransactions',
    );

    let messages =
      request.method === 'signTransaction'
        ? [bs58.decode(request.params.message)]
        : request.params.messages.map((m) => bs58.decode(m));

    async function onApprove() {
      setRequests((requests) => requests.slice(1));
      if (request.method === 'signTransaction') {
        sendSignature(messages[0]);
      } else {
        sendAllSignatures(messages);
      }
      if (requests.length === 1) {
        focusParent();
      }
    }

    async function sendSignature(message) {
      postMessage({
        result: {
          signature: await wallet.createSignature(message),
          publicKey: wallet.publicKey.toBase58(),
        },
        id: request.id,
      });
    }

    async function sendAllSignatures(messages) {
      const signatures = await Promise.all(
        messages.map((m) => wallet.createSignature(m)),
      );
      postMessage({
        result: {
          signatures,
          publicKey: wallet.publicKey.toBase58(),
        },
        id: request.id,
      });
    }

    function sendReject() {
      setRequests((requests) => requests.slice(1));
      postMessage({
        error: 'Transaction cancelled',
        id: request.id,
      });
      if (requests.length === 1) {
        focusParent();
      }
    }
    return (
      <ApproveSignatureForm
        key={request.id}
        autoApprove={autoApprove}
        origin={origin}
        messages={messages}
        onApprove={onApprove}
        onReject={sendReject}
      />
    );
  }

  return (
    <Typography>Please keep this window open in the background.</Typography>
  );
}

/**
 * Switch focus to the parent window. This requires that the parent runs
 * `window.name = 'parent'` before opening the popup.
 */
function focusParent() {
  window.open('', 'parent');
}

const useStyles = makeStyles((theme) => ({
  connection: {
    marginTop: theme.spacing(3),
    marginBottom: theme.spacing(3),
    textAlign: 'center',
  },
  transaction: {
    wordBreak: 'break-all',
  },
  approveButton: {
    backgroundColor: '#43a047',
    color: 'white',
  },
  actions: {
    justifyContent: 'space-between',
  },
  snackbarRoot: {
    backgroundColor: theme.palette.background.paper,
  },
  warningMessage: {
    margin: theme.spacing(1),
    color: theme.palette.text.primary,
  },
  warningIcon: {
    marginRight: theme.spacing(1),
    fontSize: 24,
  },
  warningTitle: {
    color: theme.palette.warning.light,
    fontWeight: 600,
    fontSize: 16,
    alignItems: 'center',
    display: 'flex',
  },
  warningContainer: {
    marginTop: theme.spacing(1),
    background: '#F29C38',
  },
  divider: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  allowTitle: {
    color: '#ECF0F3',
    fontFamily: 'Avenir Next Demi',
    marginBottom: '3rem',
    fontSize: '1.8rem',
  },
  publicKey: {
    color: '#ECF0F3',
    fontFamily: 'Avenir Next',
  },
  checkbox: {
    color: '#96999C',
  },
}));

function ApproveConnectionForm({ origin, onApprove }) {
  const wallet = useWallet();
  const classes = useStyles();
  const [autoApprove, setAutoApprove] = useState(false);

  const theme = useTheme()

  return (
    <StyledCard>
      {!wallet && <Redirect to="/create_wallet" />}
      <CardContent style={{ padding: 0 }}>
        <RowContainer margin={'0 0 2rem 0'} justify={'center'}>
          <img alt={'logo'} src={Logo} />
        </RowContainer>
        <Typography
          variant="h6"
          component="h1"
          gutterBottom
          className={classes.allowTitle}
        >
          Allow this site to access your Wallet™?
        </Typography>
        <RowContainer
          margin={'0 0 4rem 0'}
          direction={'column'}
          className={classes.connection}
        >
          <Typography className={classes.publicKey}>{origin}</Typography>
          <img
            alt={'import export icon'}
            style={{ margin: '2rem 0' }}
            src={ImportExportIcon}
          />
          <Typography className={classes.publicKey}>
            {wallet.publicKey.toBase58()}
          </Typography>
        </RowContainer>

        <RowContainer direction={'row'}>
          <Checkbox
            id="autoApprove"
            checked={autoApprove}
            onChange={() => setAutoApprove(!autoApprove)}
            color="primary"
            classes={{ root: classes.checkbox }}
          />
          <Row style={{ textAlign: 'left' }}>
            <StyledLabel htmlFor="autoApprove">
              Automatically approve transactions from{' '}
              <span style={{ color: '#ECF0F3' }}>{origin}</span>.<br />
              This will allow you to use the auto-settle function.
            </StyledLabel>
          </Row>
        </RowContainer>
        <RowContainer
          justify={'flex-start'}
          margin={'4rem 0 3rem 0'}
          padding={'0rem 3rem'}
          style={{ position: 'relative', borderRadius: '.6rem' }}
        >
          <RowContainer
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              background: '#f29c38',
              opacity: '.5',
              borderRadius: '.6rem',
            }}
          />
          <ExclamationMark theme={theme} />
          <Typography style={{ padding: '1rem 0', textAlign: 'left' }}>
            Only connect with sites you trust.{' '}
            {autoApprove &&
              'This setting allows sending some transactions on your behalf without requesting your permission for the remainder of this session.'}
          </Typography>
        </RowContainer>
      </CardContent>
      <RowContainer justify={'space-between'}>
        <WhiteButton
          width={"calc(50% - .5rem)"}
          theme={theme}
          color={'#ECF0F3'}
          onClick={window.close}
        >
          Cancel
        </WhiteButton>
        <VioletButton
          theme={theme}
          width={"calc(50% - .5rem)"}
          onClick={() => onApprove(autoApprove)}
        >
          Connect
        </VioletButton>
      </RowContainer>
    </StyledCard>
  );
}

function isSafeInstruction(publicKeys, owner, txInstructions) {
  let unsafe = false;
  const states = {
    CREATED: 0,
    OWNED: 1,
    CLOSED_TO_OWNED_DESTINATION: 2,
  };
  const accountStates = {};

  function isOwned(pubkey) {
    if (!pubkey) {
      return false;
    }
    if (
      publicKeys?.some((ownedAccountPubkey) =>
        ownedAccountPubkey.equals(pubkey),
      )
    ) {
      return true;
    }
    return accountStates[pubkey.toBase58()] === states.OWNED;
  }

  txInstructions.forEach((instructions) => {
    instructions.forEach((instruction) => {
      if (!instruction) {
        unsafe = true;
      } else {
        if (instruction.type === 'raydium') {
          // Whitelist raydium for now.
        } else if (
          ['cancelOrder', 'matchOrders', 'cancelOrderV3'].includes(
            instruction.type,
          )
        ) {
          // It is always considered safe to cancel orders, match orders
        } else if (instruction.type === 'systemCreate') {
          let { newAccountPubkey } = instruction.data;
          if (!newAccountPubkey) {
            unsafe = true;
          } else {
            accountStates[newAccountPubkey.toBase58()] = states.CREATED;
          }
        } else if (['newOrder', 'newOrderV3'].includes(instruction.type)) {
          // New order instructions are safe if the owner is this wallet
          let { openOrdersPubkey, ownerPubkey } = instruction.data;
          if (ownerPubkey && owner.equals(ownerPubkey)) {
            accountStates[openOrdersPubkey.toBase58()] = states.OWNED;
          } else {
            unsafe = true;
          }
        } else if (instruction.type === 'initializeAccount') {
          // New SPL token accounts are only considered safe if they are owned by this wallet and newly created
          let { ownerPubkey, accountPubkey } = instruction.data;
          if (
            owner &&
            ownerPubkey &&
            owner.equals(ownerPubkey) &&
            accountPubkey &&
            accountStates[accountPubkey.toBase58()] === states.CREATED
          ) {
            accountStates[accountPubkey.toBase58()] = states.OWNED;
          } else {
            unsafe = true;
          }
        } else if (instruction.type === 'settleFunds') {
          // Settling funds is only safe if the destinations are owned
          let { basePubkey, quotePubkey } = instruction.data;
          if (!isOwned(basePubkey) || !isOwned(quotePubkey)) {
            unsafe = true;
          }
        } else if (instruction.type === 'closeAccount') {
          // Closing is only safe if the destination is owned
          let { sourcePubkey, destinationPubkey } = instruction.data;
          if (isOwned(destinationPubkey)) {
            accountStates[sourcePubkey.toBase58()] =
              states.CLOSED_TO_OWNED_DESTINATION;
          } else {
            unsafe = true;
          }
        } else {
          unsafe = true;
        }
      }
    });
  });

  // Check that all accounts are owned
  if (
    Object.values(accountStates).some(
      (state) =>
        ![states.CLOSED_TO_OWNED_DESTINATION, states.OWNED].includes(state),
    )
  ) {
    unsafe = true;
  }

  return !unsafe;
}

function ApproveSignatureForm({
  origin,
  messages,
  onApprove,
  onReject,
  autoApprove,
}) {
  const classes = useStyles();
  const explorerUrlSuffix = useSolanaExplorerUrlSuffix();
  const connection = useConnection();
  const wallet = useWallet();
  const [publicKeys] = useWalletPublicKeys();

  const [parsing, setParsing] = useState(true);
  // An array of arrays, where each element is the set of instructions for a
  // single transaction.
  const [txInstructions, setTxInstructions] = useState(null);
  const buttonRef = useRef();

  const isMultiTx = messages.length > 1;

  useEffect(() => {
    Promise.all(messages.map((m) => decodeMessage(connection, wallet, m))).then(
      (txInstructions) => {
        setTxInstructions(txInstructions);
        setParsing(false);
      },
    );
  }, [messages, connection, wallet]);

  const validator = useMemo(() => {
    return {
      safe:
        publicKeys &&
        txInstructions &&
        isSafeInstruction(publicKeys, wallet.publicKey, txInstructions),
    };
  }, [publicKeys, txInstructions, wallet]);

  useEffect(() => {
    if (validator.safe && autoApprove) {
      console.log('Auto approving safe transaction');
      onApprove();
    } else {
      // brings window to front when we receive new instructions
      // this needs to be executed from wallet instead of adapter
      // to ensure chrome brings window to front
      window.focus();

      // scroll to approve button and focus it to enable approve with enter
      if (buttonRef.current) {
        buttonRef.current.scrollIntoView({ behavior: 'smooth' });
        setTimeout(() => buttonRef.current.focus(), 50);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validator, autoApprove, buttonRef]);

  const onOpenAddress = (address) => {
    address &&
      window.open(
        'https://explorer.solana.com/address/' + address + explorerUrlSuffix,
        '_blank',
      );
  };

  const getContent = (instruction) => {
    switch (instruction?.type) {
      case 'cancelOrder':
      case 'cancelOrderV2':
      case 'matchOrders':
      case 'settleFunds':
        return (
          <DexInstruction
            instruction={instruction}
            onOpenAddress={onOpenAddress}
          />
        );
      case 'closeAccount':
      case 'initializeAccount':
      case 'transfer':
      case 'approve':
      case 'mintTo':
        return (
          <TokenInstruction
            instruction={instruction}
            onOpenAddress={onOpenAddress}
          />
        );
      case 'systemCreate':
      case 'systemTransfer':
        return (
          <SystemInstruction
            instruction={instruction}
            onOpenAddress={onOpenAddress}
          />
        );
      case 'newOrder':
        return (
          <NewOrder instruction={instruction} onOpenAddress={onOpenAddress} />
        );
      case 'newOrderV3':
        return (
          <NewOrder
            instruction={instruction}
            onOpenAddress={onOpenAddress}
            v3={true}
          />
        );
      default:
        return <UnknownInstruction instruction={instruction} />;
    }
  };

  const txLabel = (idx) => {
    return (
      <>
        <Typography variant="h6" gutterBottom>
          Transaction {idx.toString()}
        </Typography>
        <Divider style={{ marginTop: 20 }} />
      </>
    );
  };

  const txListItem = (instructions, txIdx) => {
    const ixs = instructions.map((instruction, i) => (
      <Box style={{ marginTop: 20 }} key={i}>
        {getContent(instruction)}
        <Divider style={{ marginTop: 20 }} />
      </Box>
    ));

    if (!isMultiTx) {
      return ixs;
    }

    return (
      <Box style={{ marginTop: 20 }} key={txIdx}>
        {txLabel(txIdx)}
        {ixs}
      </Box>
    );
  };

  return (
    <Card>
      <CardContent>
        {parsing ? (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                marginBottom: 20,
              }}
            >
              <CircularProgress style={{ marginRight: 20 }} />
              <Typography
                variant="subtitle1"
                style={{ fontWeight: 'bold' }}
                gutterBottom
              >
                Parsing transaction{isMultiTx > 0 ? 's' : ''}:
              </Typography>
            </div>
            {messages.map((message, idx) => (
              <Typography key={idx} style={{ wordBreak: 'break-all' }}>
                {bs58.encode(message)}
              </Typography>
            ))}
          </>
        ) : (
          <>
            <Typography variant="h6" gutterBottom>
              {txInstructions
                ? `${origin} wants to:`
                : `Unknown transaction data`}
            </Typography>
            {txInstructions ? (
              txInstructions.map((instructions, txIdx) =>
                txListItem(instructions, txIdx),
              )
            ) : (
              <>
                <Typography
                  variant="subtitle1"
                  style={{ fontWeight: 'bold' }}
                  gutterBottom
                >
                  Unknown transaction{isMultiTx > 0 ? 's' : ''}:
                </Typography>
                {messages.map((message) => (
                  <Typography style={{ wordBreak: 'break-all' }}>
                    {bs58.encode(message)}
                  </Typography>
                ))}
              </>
            )}
          </>
        )}
      </CardContent>
      <CardActions className={classes.actions}>
        <BtnCustom btnColor={'#ECF0F3'} onClick={onReject}>
          Cancel
        </BtnCustom>
        <BtnCustom
          className={classes.approveButton}
          variant="contained"
          color="primary"
          onClick={onApprove}
        >
          Approve{isMultiTx ? ' All' : ''}
        </BtnCustom>
      </CardActions>
    </Card>
  );
}
