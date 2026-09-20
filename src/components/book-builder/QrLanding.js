import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useDispatch } from "react-redux";
import { appActions } from "../../store/app";

const styles = {
  page: {
    boxSizing: "border-box",
    fontFamily: "Georgia, serif",
    margin: "0 auto",
    maxWidth: "720px",
    padding: "44px 24px",
    textAlign: "center",
    width: "100%",
  },
  title: {
    fontSize: "30px",
    fontWeight: "bold",
    margin: "0 0 12px",
  },
  message: {
    color: "#555",
    fontSize: "18px",
    margin: 0,
  },
  error: {
    color: "#8a1f1f",
    fontSize: "18px",
    margin: 0,
  },
};

export default function QrLanding({ token }) {
  const [error, setError] = useState(null);
  const dispatch = useDispatch();
  const router = useRouter();

  useEffect(() => {
    dispatch(appActions.setPageLoaded());
  }, [dispatch]);

  useEffect(() => {
    let cancelled = false;

    async function resolveToken() {
      try {
        const response = await fetch(
          `/api/book-pages/resolve?token=${encodeURIComponent(token)}`,
          { cache: "no-store" }
        );
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "QR code not recognized.");
        }

        if (!cancelled) {
          router.replace({
            pathname: "/book",
            query: { token: result.pageRef.token },
          });
        }
      } catch (resolveError) {
        if (!cancelled) {
          setError(resolveError.message);
        }
      }
    }

    resolveToken();

    return () => {
      cancelled = true;
    };
  }, [router, token]);

  return (
    <div style={styles.page}>
      <p style={styles.title}>Choose rhythms to practice</p>
      {error ? (
        <p style={styles.error}>{error}</p>
      ) : (
        <p style={styles.message}>Opening this book page…</p>
      )}
    </div>
  );
}
