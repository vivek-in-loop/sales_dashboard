import React from "react";
import {
  Card,
  CardContent,
  Typography,
  Button,
  Stack,
  Chip,
} from "@mui/material";

function UploadCard({
  label,
  onFileChange,
  fileName,
  description,
  status = "Pending",
}) {
  const handleChange = (e) => {
    const file = e.target.files?.[0] || null;
    onFileChange(file);
  };

  return (
    <Card variant="outlined" sx={{ height: "100%" }}>
      <CardContent>
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle1">{label}</Typography>
            <Chip
              size="small"
              label={status}
              color={status === "Ready" ? "success" : "default"}
              variant={status === "Ready" ? "filled" : "outlined"}
            />
          </Stack>
          {description && (
            <Typography variant="caption" color="textSecondary">
              {description}
            </Typography>
          )}
          <Button variant="contained" component="label" size="small">
            Choose CSV
            <input type="file" accept=".csv" hidden onChange={handleChange} />
          </Button>
          {fileName && (
            <Typography variant="caption" color="textSecondary">
              {fileName}
            </Typography>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

export default UploadCard;


