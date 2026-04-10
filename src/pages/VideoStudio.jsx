import React from "react";
import { Navigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function RedirectToMaestroOpsHub() {
  return <Navigate to={createPageUrl("MaestroOpsHub")} replace />;
}
