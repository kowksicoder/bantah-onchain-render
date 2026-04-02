import { usePrivy } from '@privy-io/react-auth';
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from 'react';
import { apiRequest, setAuthToken } from '@/lib/queryClient';

export function useAuth() {
  const { toast } = useToast();
  const {
    ready,
    authenticated,
    user,
    login,
    logout: privyLogout,
    getAccessToken,
  } = usePrivy();
  const [stableAuthenticated, setStableAuthenticated] = useState(false);
  const [resolvingAuthToken, setResolvingAuthToken] = useState(false);

  useEffect(() => {
    if (!ready) return;

    if (!authenticated || !getAccessToken) {
      setAuthToken(null);
      setStableAuthenticated(false);
      setResolvingAuthToken(false);
      return;
    }

    setResolvingAuthToken(true);
    setStableAuthenticated(false);

    (async () => {
      try {
        const token = await getAccessToken();
        if (!token) {
          setAuthToken(null);
          setStableAuthenticated(false);
          return;
        }

        setAuthToken(token);
        setStableAuthenticated(true);

        // Apply deferred referral code after token becomes available.
        const storedReferralCode = localStorage.getItem("referralCode");
        if (storedReferralCode) {
          try {
            await apiRequest('POST', '/api/referrals/apply', { referralCode: storedReferralCode });
            localStorage.removeItem("referralCode");
          } catch (err) {
            console.error('Failed to apply referral code:', err);
          }
        }
      } catch (err) {
        console.error('Failed to get Privy access token:', err);
        setAuthToken(null);
        setStableAuthenticated(false);
      } finally {
        setResolvingAuthToken(false);
      }
    })();
  }, [authenticated, ready, getAccessToken]);

  const logout = async () => {
    try {
      await privyLogout();
      setAuthToken(null);
      setStableAuthenticated(false);
      // Force redirect to home page after logout
      window.location.replace('/');
      toast({
        title: "Logged out",
        description: "You have been logged out successfully",
      });
    } catch (error: any) {
      toast({
        title: "Logout failed",
        description: error.message || "Failed to logout",
        variant: "destructive",
      });
    }
  };

  return {
    user: stableAuthenticated ? user : null,
    isLoading: !ready || resolvingAuthToken,
    isAuthenticated: stableAuthenticated,
    login,
    logout,
    getAccessToken,
    isLoggingOut: false,
  };
}
