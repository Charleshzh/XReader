import { BrowserRouter, Routes, Route } from "react-router-dom";
import { BookshelfPage } from "@/pages/BookshelfPage";
import { ReaderPage } from "@/pages/ReaderPage";
import { StatsPage } from "@/pages/StatsPage";
import { SourceManagePage } from "@/pages/SourceManagePage";
import { SearchPage } from "@/pages/SearchPage";
import "./globals.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<BookshelfPage />} />
        <Route path="/reader/:bookId" element={<ReaderPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="/sources" element={<SourceManagePage />} />
        <Route path="/search" element={<SearchPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
