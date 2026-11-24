/** Logotipo do Corrida dos Dois (bandeira quadriculada + nome). */
import { Link } from "react-router";

export function Brand({ size = "small" }: { size?: "small" | "large" }) {
  return (
    <Link to="/" className={`brand brand--${size}`} aria-label="Corrida dos Dois — início">
      <span className="brand__flag" aria-hidden="true" />
      <span className="brand__text">
        Corrida <em>dos</em> Dois
      </span>
    </Link>
  );
}
