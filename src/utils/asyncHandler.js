const asyncHandler = (requestHandler) => {
    return (req, res, next) => {
        Promise.resolve(requestHandler(req, res, next))
            .catch((err) => next(err));
    }
}



export default asyncHandler;






// ()=>{}
// (fn) =>{ ()=>{ } }
// (fn) => ()=>{ }

// const asyncHandler = (fn ) = async (req, res, next) => {
//   try {
//     await fn(req, res, next);
//   } catch (error) {
//     res.status(error.status || 500).json({
//       message:
//         error.message ||
//         "Something went wrong : asyncHandler : asyncHandler.js",
//     });
//   }
// });
