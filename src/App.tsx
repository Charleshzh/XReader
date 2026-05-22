import { BrowserRouter, Routes, Route } from "react-router-dom";
import { BookshelfPage } from "@/pages/BookshelfPage";
import { ReaderPage } from "@/pages/ReaderPage";
import "./globals.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<BookshelfPage />} />
        <Route path="/reader/:bookId" element={<ReaderPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
