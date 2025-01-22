import { Outlet } from "react-router"

function Body() {
    return (
        <div className="w-full h-full">
            <Outlet/>
        </div>
    )
}

export default Body
