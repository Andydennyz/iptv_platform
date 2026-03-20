import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/", { replace: true });
  }, [navigate]);

  return (
    <div className="flex flex-col items-center justify-center h-svh gap-4">
      <p className="text-sm text-muted-foreground">Auth callback completed, redirecting...</p>
    </div>
  );
}

