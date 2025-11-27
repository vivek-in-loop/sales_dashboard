import React from "react";
import {
  Card,
  CardContent,
  Stack,
  TextField,
  Typography,
  IconButton,
  Button,
  Chip,
} from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";

function SdrCard({
  index,
  sdr,
  onNameChange,
  onSendFileChange,
  onOpenFileChange,
  onRemove,
  canRemove,
}) {
  const sendStatus = sdr.sendFile ? "Ready" : "Missing Send";
  const openStatus = sdr.openFile ? "Ready" : "Missing Open";

  const handleSendChange = (event) => {
    const file = event.target.files?.[0] || null;
    onSendFileChange(file);
  };

  const handleOpenChange = (event) => {
    const file = event.target.files?.[0] || null;
    onOpenFileChange(file);
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle1">
              SDR #{index + 1}
            </Typography>
            <IconButton
              size="small"
              onClick={onRemove}
              disabled={!canRemove}
              color="error"
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Stack>
          <TextField
            size="small"
            label="SDR Name"
            value={sdr.name}
            placeholder="e.g. Harshit"
            onChange={(e) => onNameChange(e.target.value)}
            fullWidth
          />
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2">Send CSV</Typography>
              <Chip
                size="small"
                label={sendStatus}
                color={sdr.sendFile ? "success" : "default"}
                variant={sdr.sendFile ? "filled" : "outlined"}
              />
            </Stack>
            <Button variant="contained" component="label" size="small">
              Choose Send CSV
              <input type="file" accept=".csv" hidden onChange={handleSendChange} />
            </Button>
            {sdr.sendFile && (
              <Typography variant="caption" color="textSecondary">
                {sdr.sendFile.name}
              </Typography>
            )}
          </Stack>
          <Stack spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2">Open CSV</Typography>
              <Chip
                size="small"
                label={openStatus}
                color={sdr.openFile ? "success" : "default"}
                variant={sdr.openFile ? "filled" : "outlined"}
              />
            </Stack>
            <Button variant="contained" component="label" size="small">
              Choose Open CSV
              <input type="file" accept=".csv" hidden onChange={handleOpenChange} />
            </Button>
            {sdr.openFile && (
              <Typography variant="caption" color="textSecondary">
                {sdr.openFile.name}
              </Typography>
            )}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default SdrCard;


