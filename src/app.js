import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";


const app = express();

app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
}));

app.use(express.json( {limit: '50kb'}));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true , limit: '50kb'}));
app.use(express.static("public"));

// import routers
import userRoutes from "../src/routes/user.routes.js";

//routes 

app.use("/api/v1/user", userRoutes);


export { app };