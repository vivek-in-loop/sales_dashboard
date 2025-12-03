import React from "react";
import { Box, Card, CardContent, Typography } from "@mui/material";
import { TrendingUp } from "@mui/icons-material";

function KpiCard({ title, value, helper, icon, color }) {
  const cardStyles = {
    primary: {
      bgcolor: "#f1faee",
      borderColor: "#457b9d",
      iconColor: "#1d3557",
      textColor: "#1d3557",
    },
    success: {
      bgcolor: "#f1faee",
      borderColor: "#a8dadc",
      iconColor: "#457b9d",
      textColor: "#1d3557",
    },
    info: {
      bgcolor: "#f1faee",
      borderColor: "#a8dadc",
      iconColor: "#457b9d",
      textColor: "#1d3557",
    },
    warning: {
      bgcolor: "#fff5f5",
      borderColor: "#e63946",
      iconColor: "#e63946",
      textColor: "#1d3557",
    },
    default: {
      bgcolor: "#f1faee",
      borderColor: "#a8dadc",
      iconColor: "#457b9d",
      textColor: "#1d3557",
    },
  };

  const style = cardStyles[color] || cardStyles.default;

  return (
    <Card
      elevation={3}
      sx={{
        minWidth: 160,
        height: "100%",
        bgcolor: style.bgcolor,
        border: `3px solid ${style.borderColor}`,
        borderRadius: 3,
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        position: "relative",
        overflow: "hidden",
        "&:hover": {
          transform: "translateY(-6px) scale(1.02)",
          boxShadow: `0 12px 24px ${style.borderColor}40`,
          borderColor: style.iconColor,
        },
        "&::before": {
          content: '""',
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "4px",
          bgcolor: style.borderColor,
          transition: "height 0.3s",
        },
        "&:hover::before": {
          height: "6px",
        },
      }}
    >
      <CardContent sx={{ position: "relative", zIndex: 1 }}>
        <Box
          sx={{
            position: "absolute",
            top: -20,
            right: -20,
            width: 80,
            height: 80,
            borderRadius: "50%",
            bgcolor: style.borderColor,
            opacity: 0.08,
            transition: "all 0.3s",
          }}
        />
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1.5 }}>
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 700,
              color: style.textColor,
              fontSize: "0.75rem",
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            {title}
          </Typography>
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              bgcolor: `${style.borderColor}30`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.3s",
            }}
          >
            {icon || (
              <TrendingUp
                sx={{
                  fontSize: 18,
                  color: style.iconColor,
                }}
              />
            )}
          </Box>
        </Box>
        <Typography
          variant="h3"
          component="div"
          sx={{
            fontWeight: 800,
            mb: 0.5,
            color: style.textColor,
            fontSize: { xs: "1.75rem", sm: "2rem", md: "2.25rem" },
            lineHeight: 1.1,
            letterSpacing: "-0.5px",
          }}
        >
          {value}
        </Typography>
        {helper && (
          <Box
            sx={{
              mt: 1,
              pt: 1,
              borderTop: `1px solid ${style.borderColor}40`,
            }}
          >
            <Typography
              variant="caption"
              sx={{
                color: style.textColor,
                opacity: 0.8,
                fontSize: "0.7rem",
                fontWeight: 600,
                display: "block",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              {helper}
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

export default KpiCard;


