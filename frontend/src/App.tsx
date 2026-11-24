/** Rotas da aplicação e provedores de estado. */
import { BrowserRouter, Link, Route, Routes } from "react-router";
import { Notices } from "./components/Notices";
import { GameProvider } from "./contexts/GameContext";
import { SessionProvider } from "./contexts/SessionContext";
import { HomePage } from "./pages/HomePage";
import { RankingPage } from "./pages/RankingPage";
import { RoomPage } from "./pages/RoomPage";

export default function App() {
  return (
    <SessionProvider>
      <GameProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/sala/:code" element={<RoomPage />} />
            <Route path="/ranking" element={<RankingPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Notices />
        </BrowserRouter>
      </GameProvider>
    </SessionProvider>
  );
}

function NotFound() {
  return (
    <main className="page__content page__content--narrow">
      <section className="panel center-panel">
        <h1 className="panel__title">Saiu da pista!</h1>
        <p>Essa página não existe.</p>
        <Link to="/" className="btn btn--primary">
          Voltar ao início
        </Link>
      </section>
    </main>
  );
}
