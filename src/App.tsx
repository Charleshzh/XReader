import { BrowserRouter, Routes, Route } from "react-router-dom";
import { BookshelfPage } from "@/pages/BookshelfPage";
import "./globals.css";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<BookshelfPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
