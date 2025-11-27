import React from "react";
import { Card, CardContent, Typography } from "@mui/material";

function KpiCard({ title, value, helper }) {
  return (
    <Card variant="outlined" sx={{ minWidth: 160 }}>
      <CardContent>
        <Typography variant="subtitle2" color="textSecondary" gutterBottom>
          {title}
        </Typography>
        <Typography variant="h5" component="div">
          {value}
        </Typography>
        {helper && (
          <Typography variant="caption" color="textSecondary">
            {helper}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

export default KpiCard;


