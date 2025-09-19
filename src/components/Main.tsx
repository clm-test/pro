import { useState, useEffect, useRef } from "react";
import {
  useAccount,
  useReadContract,
  useSendCalls,
  useConnect,
  useChainId,
  useSwitchChain,
} from "wagmi";
import { base } from "wagmi/chains";
import { config } from "~/components/providers/WagmiProvider";
import sdk, { type Context } from "@farcaster/miniapp-sdk";
import { formatUnits, encodeFunctionData, parseUnits } from "viem";
import { useSearchParams } from "next/navigation";
import { tierRegistryAbi } from "../contracts/tierRegistryAbi.js";

const TIER_REGISTRY_ADDRESS =
  "0x00000000fc84484d585C3cF48d213424DFDE43FD" as const;
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const EXTRA_FEE_RECIPIENT = "0x21808EE320eDF64c019A6bb0F7E4bFB3d62F06Ec";

const erc20Abi = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
];

export default function Main() {
  const { isConnected, chain } = useAccount();

  const [totalPrice, setTotalPrice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<Context.MiniAppContext>();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [isClicked, setIsClicked] = useState(false);

  const EXTRA_FEE = parseUnits("0.5", 6); // 0.5 USDC (6 decimals)

  useEffect(() => {
    const load = async () => {
      const context = await sdk.context;
      setContext(context);
      sdk.actions.ready({});
    };
    if (sdk && !isSDKLoaded) {
      setIsSDKLoaded(true);
      load();
      return () => {
        sdk.removeAllListeners();
      };
    }
  }, [isSDKLoaded]);

  const [fid, setFid] = useState<number | undefined>(undefined);
  const [paymentToken, setPaymentToken] = useState<`0x${string}` | null>(null);
  const [tokenDecimals, setTokenDecimals] = useState<number>(6); // USDC has 6 decimals

  // Fetch tier info for tierId=1
  const { data: tierInfoData, error: tierInfoError } = useReadContract({
    address: TIER_REGISTRY_ADDRESS,
    abi: tierRegistryAbi,
    functionName: "tierInfo",
    args: [1],
    chainId: base.id,
  } as const) as {
    data:
      | {
          minDays: bigint;
          maxDays: bigint;
          paymentToken: `0x${string}`;
          tokenPricePerDay: bigint;
          vault: string;
          isActive: boolean;
        }
      | undefined;
    error: Error | null;
  };

  // Fetch token decimals for paymentToken
  const { data: decimalsData, error: decimalsError } = useReadContract({
    address: paymentToken ?? undefined,
    abi: erc20Abi,
    functionName: "decimals",
    chainId: base.id,
  } as const) as { data: number | undefined; error: Error | null };

  // Fetch subscription price for tierId=1, forDays=30
  const {
    data: priceData,
    isLoading: isPriceLoading,
    error: priceError,
  } = useReadContract({
    address: TIER_REGISTRY_ADDRESS,
    abi: tierRegistryAbi,
    functionName: "price",
    args: [1, 30],
    chainId: base.id,
  } as const) as {
    data: bigint | undefined;
    isLoading: boolean;
    error: Error | null;
  };

  // Batch transaction hook
  const {
    sendCalls,
    error: sendCallsError,
    isPending: isTxPending,
    isSuccess: isTxSuccess,
  } = useSendCalls();

  // Update subscription price, payment token, and decimals
  useEffect(() => {
    if (tierInfoError) {
      console.error("Tier info error:", tierInfoError);
      setError(`Failed to fetch tier info: ${tierInfoError.message}`);
    } else if (tierInfoData) {
      console.log("Tier info:", tierInfoData);
      setPaymentToken(tierInfoData.paymentToken);
      if (!tierInfoData.isActive) {
        setError("Tier 1 is not active.");
      } else if (
        tierInfoData.paymentToken.toLowerCase() !== USDC_ADDRESS.toLowerCase()
      ) {
        setError("Tier 1 does not use USDC as payment token.");
      }
    }

    if (decimalsError) {
      console.error("Decimals fetch error:", decimalsError);
      setError(`Failed to fetch token decimals: ${decimalsError.message}`);
    } else if (decimalsData) {
      console.log("Token decimals:", decimalsData);
      setTokenDecimals(decimalsData);
    }

    if (priceError) {
      console.error("Price fetch error:", priceError);
      setError(`Failed to fetch price: ${priceError.message}`);
    } else if (priceData && paymentToken) {
      console.log("Price data:", priceData);
      setTotalPrice(formatUnits(priceData + EXTRA_FEE, tokenDecimals));
    } else {
      console.log("No price data or payment token yet.");
    }
  }, [
    tierInfoData,
    tierInfoError,
    decimalsData,
    decimalsError,
    priceData,
    priceError,
    paymentToken,
    tokenDecimals,
    EXTRA_FEE,
  ]);

  // Handle batch purchase (approve + purchaseTier + transfer extra fee)
  const handleBatchPurchase = async () => {
    setIsClicked(true);
    setTimeout(() => {
      if (!isConnected) {
        setError("Please connect your wallet.");
        setIsClicked(false);
        return;
      }
      if (chain?.id !== base.id) {
        setError("Please switch to the Base network.");
        setIsClicked(false);
        return;
      }
      if (!paymentToken || !priceData) {
        setError("Payment token or price not available.");
        setIsClicked(false);
        return;
      }
      if (!fid || isNaN(Number(fid))) {
        setError("No valid Farcaster ID found.");
        setIsClicked(false);
        return;
      }
      if (
        tierInfoData?.paymentToken.toLowerCase() !==
          USDC_ADDRESS.toLowerCase() ||
        !tierInfoData?.isActive
      ) {
        setError("Invalid tier or payment token.");
        setIsClicked(false);
        return;
      }

      try {
        const totalCost = priceData + EXTRA_FEE;
        sendCalls({
          calls: [
            // Call 1: Approve TierRegistry to spend total USDC (subscription + extra)
            {
              to: USDC_ADDRESS,
              data: encodeFunctionData({
                abi: erc20Abi,
                functionName: "approve",
                args: [TIER_REGISTRY_ADDRESS, totalCost],
              }),
            },
            // Call 2: Purchase the tier
            {
              to: TIER_REGISTRY_ADDRESS,
              data: encodeFunctionData({
                abi: tierRegistryAbi,
                functionName: "purchaseTier",
                args: [BigInt(fid), 1, 30],
              }),
            },
            // Call 3: Transfer extra 0.5 USDC to your wallet
            {
              to: USDC_ADDRESS,
              data: encodeFunctionData({
                abi: erc20Abi,
                functionName: "transfer",
                args: [EXTRA_FEE_RECIPIENT, EXTRA_FEE],
              }),
            },
          ],
        });
      } catch (err: unknown) {
        setError(
          "Failed to initiate batch purchase: " +
            (err instanceof Error ? err.message : String(err))
        );
        setIsClicked(false);
      }
    }, 500);
  };

  async function sendMessage(recipientFid: number, message: string) {
    const res = await fetch("/api/dc", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "idempotency-key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        recipientFid,
        message,
      }),
    });

    const data = await res.json();
    console.log("Sent message:", data);
  }

  useEffect(() => {
    if (isTxSuccess && context?.user?.fid) {
      const message = castFid
        ? `You Gifted Farcaster Pro to FID: ${castFid} for 30 days!`
        : "You Subscribed Farcaster Pro for 30 days!";
      sendMessage(context?.user?.fid, message);
    }
  }, [isTxSuccess]);

  const searchParams = useSearchParams();
  const castFid = searchParams.get("castFid");

  useEffect(() => {
    if (castFid) {
      setFid(Number(castFid));
    } else if (context?.user?.fid) {
      setFid(context.user.fid);
    }
  }, [context, castFid]);

  useEffect(() => {
    if (isTxSuccess && castFid) {
      const message = "Gifted you Farcaster Pro for 30 days!";
      sendMessage(Number(castFid), `@${context?.user.username} ${message}`);
    }
  }, [isTxSuccess, castFid]);

  const errorMessagesSent = useRef(new Set<string>()); 
  useEffect(() => {
    const sendErrorMessage = async (errorType: string, message: string) => {
      // Avoid sending duplicate error messages
      if (errorMessagesSent.current.has(`${errorType}:${message}`)) return;
      errorMessagesSent.current.add(`${errorType}:${message}`);

      try {
        await sendMessage(268438, `Error in Farcaster Pro: ${message}`);
      } catch (err) {
        console.error(`Failed to send error message for ${errorType}:`, err);
      }
    };

    if (tierInfoError) {
      sendErrorMessage(
        "tierInfo",
        `Failed to fetch tier info: ${tierInfoError.message}`
      );
    }
    if (decimalsError) {
      sendErrorMessage(
        "decimals",
        `Failed to fetch token decimals: ${decimalsError.message}`
      );
    }
    if (priceError) {
      sendErrorMessage("price", `Failed to fetch price: ${priceError.message}`);
    }
    if (sendCallsError) {
      sendErrorMessage(
        "sendCalls",
        `Batch transaction failed: ${sendCallsError.message}`
      );
    }
    if (error) {
      sendErrorMessage("general", error);
    }
  }, [
    tierInfoError,
    decimalsError,
    priceError,
    sendCallsError,
    error,
    context?.user?.fid,
    castFid,
  ]);

  if (!context)
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="flex flex-col items-center justify-center text-white text-2xl p-4">
          <p className="flex items-center justify-center text-center">
            You need to access this mini app from inside a farcaster client
          </p>
          <div
            className="flex items-center justify-center text-center bg-indigo-800 p-3 rounded-lg mt-4 cursor-pointer"
            onClick={() =>
              window.open("https://farcaster.xyz/cashlessman.eth/0x9cb4af72")
            }
          >
            Open in Farcaster
          </div>
        </div>
      </div>
    );

  return (
    <div
      style={{
        paddingTop: context?.client.safeAreaInsets?.top ?? 0,
        paddingBottom: context?.client.safeAreaInsets?.bottom ?? 0,
        paddingLeft: context?.client.safeAreaInsets?.left ?? 0,
        paddingRight: context?.client.safeAreaInsets?.right ?? 0,
      }}
      className="h-screen bg-slate-800 flex flex-col items-center justify-center"
    >
      {!isConnected ? (
        <Connect />
      ) : chainId !== base.id ? (
        <Switch />
      ) : (
        <div>
          <header className="flex-none fixed top-0 left-0 w-full p-7">
            <h1 className="text-center text-2xl font-bold text-white mb-4">
              Farcaster Pro
            </h1>
            <div className="flex justify-between items-center">
              <button
                onClick={() =>
                  sdk.actions.viewCast({
                    hash: "0x8b41703ba1998102f5cac507493ba081061af5e6",
                  })
                }
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition cursor-pointer font-semibold"
              >
                How to Gift
              </button>
              <button
                onClick={() =>
                  sdk.actions.composeCast({
                    text: `Purchase and Gift Farcaster Pro for 30 days with this miniapp by @cashlessman.eth`,
                    embeds: [`${process.env.NEXT_PUBLIC_URL}`],
                  })
                }
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition cursor-pointer font-semibold"
              >
                Share
              </button>
            </div>
          </header>

          <div className="text-white text-center mb-5">
            <div className="text-xl mb-1">subscribing for</div>
            <div className="font-bold text-2xl">FID: {fid ?? "loading"}</div>
            <div className="text-xl font-bold">
              Cost:{" "}
              {isPriceLoading
                ? "Loading..."
                : totalPrice
                ? `${totalPrice} USDC`
                : "N/A"}
            </div>
            <div className="text-xs">(includes maintence fee)</div>
          </div>
          {tierInfoError &&<SendDC/>}
          {decimalsError &&<SendDC/>}
          {priceError &&<SendDC/>}
          <div className="flex gap-3">
            <div>
              <button
                onClick={handleBatchPurchase}
                disabled={
                  isTxPending ||
                  !isConnected ||
                  chain?.id !== base.id ||
                  !paymentToken ||
                  !priceData
                }
                className="text-white text-center py-2 rounded-xl font-semibold text-lg shadow-lg relative overflow-hidden transform transition-all duration-200 hover:scale-110 active:scale-95 flex items-center justify-center gap-2"
                style={{
                  background:
                    "linear-gradient(90deg, #8B5CF6, #7C3AED, #A78BFA, #8B5CF6)",
                  backgroundSize: "300% 100%",
                  animation: "gradientAnimation 3s infinite ease-in-out",
                }}
              >
                <div
                  className={`absolute inset-0 bg-[#38BDF8] transition-all duration-500 ${
                    isClicked ? "scale-x-100" : "scale-x-0"
                  }`}
                  style={{ transformOrigin: "center" }}
                ></div>
                <style>{`
                  @keyframes gradientAnimation {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                  }
                `}</style>
                <div className="flex flex-row gap-2 px-5">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-6 h-6 relative z-10"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z"
                    />
                  </svg>{" "}
                  <span className="relative z-10">
                    {isTxPending
                      ? "Processing..."
                      : isTxSuccess
                      ? castFid
                        ? "Gifted!"
                        : "Purchased!"
                      : "Purchase Pro for 30 days"}
                  </span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-6 h-6 relative z-10"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z"
                    />
                  </svg>{" "}
                </div>
              </button>
            </div>
          </div>
          {isTxSuccess && (
            <div className="mt-4 flex flex-col items-center">
              <p className="text-lime-500 text-center">
                Transaction successful!
              </p>
            </div>
          )}
          {error &&<SendDC/>}
        </div>
      )}
    </div>
  );

  function Connect() {
    const { connect } = useConnect();
    const [isClicked, setIsClicked] = useState(false);

    const handleConnect = () => {
      setIsClicked(true);
      setTimeout(() => {
        connect({ connector: config.connectors[0] });
      }, 500);

      setTimeout(() => setIsClicked(false), 500);
    };

    return (
      <div className="flex flex-col mt-2">
        <button
          onClick={handleConnect}
          className="text-white text-center py-2 rounded-xl font-semibold text-lg shadow-lg relative overflow-hidden transform transition-all duration-200 hover:scale-110 active:scale-95 flex items-center justify-center gap-2"
          style={{
            background:
              "linear-gradient(90deg, #8B5CF6, #7C3AED, #A78BFA, #8B5CF6)",
            backgroundSize: "300% 100%",
            animation: "gradientAnimation 3s infinite ease-in-out",
          }}
        >
          <div
            className={`absolute inset-0 bg-[#38BDF8] transition-all duration-500 ${
              isClicked ? "scale-x-100" : "scale-x-0"
            }`}
            style={{ transformOrigin: "center" }}
          ></div>
          <style>{`
              @keyframes gradientAnimation {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
              }
            `}</style>
          <div className="flex flex-row gap-2 px-5">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6 relative z-10"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z"
              />
            </svg>{" "}
            <span className="relative z-10">Connect Wallet</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6 relative z-10"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z"
              />
            </svg>{" "}
          </div>
        </button>
      </div>
    );
  }

  function Switch() {
    const [isClicked, setIsClicked] = useState(false);

    const handleConnect = () => {
      setIsClicked(true);
      setTimeout(() => {
        switchChain({ chainId: base.id });
      }, 500);

      setTimeout(() => setIsClicked(false), 500);
    };

    return (
      <div className="flex flex-col mt-2">
        <button
          onClick={handleConnect}
          className="text-white text-center py-2 rounded-xl font-semibold text-lg shadow-lg relative overflow-hidden transform transition-all duration-200 hover:scale-110 active:scale-95 flex items-center justify-center gap-2"
          style={{
            background:
              "linear-gradient(90deg, #8B5CF6, #7C3AED, #A78BFA, #8B5CF6)",
            backgroundSize: "300% 100%",
            animation: "gradientAnimation 3s infinite ease-in-out",
          }}
        >
          <div
            className={`absolute inset-0 bg-[#38BDF8] transition-all duration-500 ${
              isClicked ? "scale-x-100" : "scale-x-0"
            }`}
            style={{ transformOrigin: "center" }}
          ></div>
          <style>{`
              @keyframes gradientAnimation {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
              }
            `}</style>
          <div className="flex flex-row gap-2 px-5">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6 relative z-10"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z"
              />
            </svg>{" "}
            <span className="relative z-10">Switch to Base</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-6 h-6 relative z-10"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z"
              />
            </svg>{" "}
          </div>
        </button>
      </div>
    );
  }

  function SendDC() {
    return (
      <div className="flex flex-col items-center mt-4">
        <p className="text-red-500 mb-2 text-center">
          There was an error. Please send a DM to the developer.
        </p>
        <button
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition cursor-pointer font-semibold"
 onClick={()=>sdk.actions.openUrl("https://farcaster.xyz/~/inbox/create/268438?text=GM\nI'm having trouble purchasing Pro, can you please check")
         }        >
          Send DM
        </button>
      </div>
    );
  }
}
