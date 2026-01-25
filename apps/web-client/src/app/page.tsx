export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-blue-50 via-white to-indigo-50 p-4">
      <div className="text-center space-y-8">
        <div className="space-y-4">
          <h1 className="text-5xl font-bold bg-linear-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            OLMS Platform
          </h1>
          <p className="text-xl text-slate-600 font-medium">Online Learning Management System</p>
          <p className="text-slate-500">A modern microservices-based learning platform</p>
        </div>
        <div className="flex gap-4 justify-center">
          <a
            href="/login"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-8 py-3 text-base font-semibold text-white shadow-lg hover:bg-blue-700 transition-all hover:shadow-xl"
          >
            Login
          </a>
          <a
            href="/register"
            className="inline-flex items-center justify-center rounded-lg border-2 border-blue-600 bg-white px-8 py-3 text-base font-semibold text-blue-600 shadow-md hover:bg-blue-50 transition-all"
          >
            Create Account
          </a>
        </div>
      </div>
    </div>
  );
}
