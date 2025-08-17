import { useState, useEffect } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useConnect,
  useChainId,
  useSwitchChain,
} from "wagmi";
import { base } from "wagmi/chains";
import { config } from "~/components/providers/WagmiProvider";
import sdk, { type Context } from "@farcaster/miniapp-sdk";
import { abi } from "../contracts/keyRegistry.js";
import { formatUnits } from "viem";

const TIER_REGISTRY_ADDRESS = "0x00000000fc84484d585C3cF48d213424DFDE43FD";
const tierRegistryAbi = abi;
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
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
];

export default function Main() {
  const { isConnected, chain } = useAccount();
  const [subscriptionPrice, setSubscriptionPrice] = useState<string | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<Context.MiniAppContext>();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [isClicked, setIsClicked] = useState(false);
  const [BaseClicked, setBaseClicked] = useState(false);

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

  const fid = context?.user?.fid;
  const [paymentToken, setPaymentToken] = useState<`0x${string}` | null>(null);
  const [tokenDecimals, setTokenDecimals] = useState<number>(18); // Default to 18
  const [isApproved, setIsApproved] = useState(false);

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

  // Handle token approval and purchase
  const {
    writeContract,
    data: hash,
    isPending,
    error: writeError,
  } = useWriteContract();
  const { isLoading: isTxLoading, isSuccess: isTxSuccess } =
    useWaitForTransactionReceipt({ hash });

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
      setSubscriptionPrice(formatUnits(priceData, tokenDecimals));
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
  ]);

  const handleApprove = async () => {
    setIsClicked(true);
    setTimeout(() => {
      if (!isConnected) {
        setError("Please connect your wallet.");
        return;
      }
      if (chain?.id !== base.id) {
        setError("Please switch to the Base network.");
        return;
      }
      if (!paymentToken || !priceData) {
        setError("Payment token or price not available.");
        return;
      }

      try {
        writeContract({
          address: paymentToken,
          abi: erc20Abi,
          functionName: "approve",
          args: [TIER_REGISTRY_ADDRESS, priceData],
          chainId: base.id,
        });
        setIsApproved(true);
      } catch (err: unknown) {
        setError(
          "Failed to approve token: " +
            (err instanceof Error ? err.message : String(err))
        );
      }
    }, 500);

    setTimeout(() => setIsClicked(false), 500);
  };

  const handlePurchase = async () => {
    setIsClicked(true);
    setTimeout(() => {
      if (!isConnected) {
        setError("Please connect your wallet.");
        return;
      }
      if (chain?.id !== base.id) {
        setError("Please switch to the Base network.");
        return;
      }
      if (!priceData) {
        setError("Subscription price not available.");
        return;
      }
      if (!fid || isNaN(Number(fid))) {
        setError("No valid Farcaster ID found.");
        return;
      }
      if (!isApproved) {
        setError("Please approve the token first.");
        return;
      }

      try {
        writeContract({
          address: TIER_REGISTRY_ADDRESS,
          abi: tierRegistryAbi,
          functionName: "purchaseTier",
          args: [BigInt(fid), 1, 30],
          chainId: base.id,
        });
      } catch (err: unknown) {
        setError(
          "Failed to initiate purchase: " +
            (err instanceof Error ? err.message : String(err))
        );
      }
    }, 500);

    setTimeout(() => setIsClicked(false), 500);
  };

  const baseScan = () => {
    setBaseClicked(true);
    setTimeout(() => {
      sdk.actions.openUrl(`https://basescan.org/tx/${hash}`);
    }, 500);

    setTimeout(() => setBaseClicked(false), 500);
  };

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
      {!isConnected || chain?.id !== base.id ? (
        <ConnectButton />
      ) : (
        <div className="">
          <h1 className="fixed top-0 left-1/2 -translate-x-1/2 text-2xl font-bold text-white mt-8">
            Farcaster Pro
          </h1>

          <div className="text-white text-center mb-8">
            <div className="font-medium text-2xl mb-3">Subscription cost:</div>
            <div className="text-4xl font-bold">
              {isPriceLoading
                ? "Loading..."
                : subscriptionPrice
                ? `${subscriptionPrice} USDC`
                : "N/A"}
            </div>
          </div>
          {tierInfoError && (
            <p className="text-red-600">
              Tier info error: {tierInfoError.message}
            </p>
          )}
          {decimalsError && (
            <p className="text-red-600">
              Decimals fetch error: {decimalsError.message}
            </p>
          )}
          {priceError && (
            <p className="text-red-600">
              Price fetch error: {priceError.message}
            </p>
          )}

          <div className="flex gap-3">
            {!isApproved ? (
              <div>
                <button
                  onClick={handleApprove}
                  disabled={
                    isPending ||
                    isTxLoading ||
                    !isConnected ||
                    chain?.id !== base.id ||
                    !paymentToken
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
                      {isPending || isTxLoading
                        ? "Processing..."
                        : "Approve USDC"}
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
            ) : (
              <div>
                <button
                  onClick={handlePurchase}
                  disabled={
                    isPending ||
                    isTxLoading ||
                    !isConnected ||
                    chain?.id !== base.id ||
                    !isApproved
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
                      {isPending || isTxLoading
                        ? "Processing..."
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
            )}
          </div>

          {!isTxSuccess && (
            <div className="mt-4 flex flex-col items-center">
              <p className="text-lime-500 text-center">
                Transaction successful!
              </p>
              <button
                onClick={baseScan}
                className="text-white mt-4 text-center py-2 rounded-xl font-semibold text-lg shadow-lg relative overflow-hidden transform transition-all duration-200 hover:scale-110 active:scale-95 flex items-center justify-center gap-2"
                style={{
                  background:
                    "linear-gradient(90deg, #8B5CF6, #7C3AED, #A78BFA, #8B5CF6)",
                  backgroundSize: "300% 100%",
                  animation: "gradientAnimation 3s infinite ease-in-out",
                }}
              >
                <div
                  className={`absolute inset-0 bg-[#38BDF8] transition-all duration-500 ${
                    BaseClicked ? "scale-x-100" : "scale-x-0"
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
                  <span className="relative z-10">View on Basescan</span>
                </div>
              </button>
            </div>
          )}
          {error && <p className="text-red-600 w-screen">{error}</p>}
          {writeError && (
            <p className="text-red-600 w-screen">Error: {writeError.message}</p>
          )}
        </div>
      )}
    </div>
  );

  function ConnectButton() {
    const { connect } = useConnect();
    const [isClicked, setIsClicked] = useState(false);

    const handleConnect = () => {
      setIsClicked(true);
      setTimeout(() => {
        if (chainId !== base.id) {
          switchChain({ chainId: base.id });
        } else {
          connect({ connector: config.connectors[0] });
        }
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
            <span className="relative z-10">
              {chainId !== base.id ? "Switch to Base" : "Connect Wallet"}
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
    );
  }
}
