import { useState } from 'react'
import './App.css'
import { BrowserRouter, Routes, Route } from 'react-router'

//INTERNAL IMPORTS
import Login from './pages/LoginPage/Login';
import Body from './pages/Body/Body';

function App() {
  const [count, setCount] = useState(0);
  console.log("Hlell");

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Body/>}>
            <Route path='/login' element={<Login />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </>
  )
}

export default App
