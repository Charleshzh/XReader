import { BrowserRouter, Routes, Route } from "react-router-dom";
import { BookshelfPage } from "@/pages/BookshelfPage";
import { ReaderPage } from "@/pages/ReaderPage";
import { StatsPage } from "@/pages/StatsPage";
import { SourceManagePage } from "@/pages/SourceManagePage";
import { SearchPage } from "@/pages/SearchPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { DiscoverPage } from "@/pages/DiscoverPage";
import "./globals.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";

function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          <Route path="/" element={<BookshelfPage />} />
          <Route path="/reader/:bookId" element={<ReaderPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/sources" element={<SourceManagePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/discover" element={<DiscoverPage />} />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
