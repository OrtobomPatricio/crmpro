export type AmericasCountry = {
  value: string;
  label: string;
  code: string;
};

// Continente Americano: países de habla Español / Inglés / Portugués
// Nota: varios países del Caribe comparten el prefijo +1 (NANP)
export const AMERICAS_COUNTRIES: AmericasCountry[] = [
  // Español (América)
  { value: "Argentina", label: "Argentina", code: "+54" },
  { value: "Bolivia", label: "Bolivia", code: "+591" },
  { value: "Chile", label: "Chile", code: "+56" },
  { value: "Colombia", label: "Colombia", code: "+57" },
  { value: "Costa Rica", label: "Costa Rica", code: "+506" },
  { value: "Cuba", label: "Cuba", code: "+53" },
  { value: "Ecuador", label: "Ecuador", code: "+593" },
  { value: "El Salvador", label: "El Salvador", code: "+503" },
  { value: "Guatemala", label: "Guatemala", code: "+502" },
  { value: "Honduras", label: "Honduras", code: "+504" },
  { value: "México", label: "México", code: "+52" },
  { value: "Nicaragua", label: "Nicaragua", code: "+505" },
  { value: "Panamá", label: "Panamá", code: "+507" },
  { value: "Paraguay", label: "Paraguay", code: "+595" },
  { value: "Perú", label: "Perú", code: "+51" },
  { value: "Puerto Rico", label: "Puerto Rico", code: "+1" },
  { value: "República Dominicana", label: "República Dominicana", code: "+1" },
  { value: "Uruguay", label: "Uruguay", code: "+598" },
  { value: "Venezuela", label: "Venezuela", code: "+58" },

  // Portugués
  { value: "Brasil", label: "Brasil", code: "+55" },

  // Inglés (América)
  { value: "Antigua y Barbuda", label: "Antigua y Barbuda", code: "+1" },
  { value: "Bahamas", label: "Bahamas", code: "+1" },
  { value: "Barbados", label: "Barbados", code: "+1" },
  { value: "Belice", label: "Belice", code: "+501" },
  { value: "Canadá", label: "Canadá", code: "+1" },
  { value: "Dominica", label: "Dominica", code: "+1" },
  { value: "Estados Unidos", label: "Estados Unidos", code: "+1" },
  { value: "Granada", label: "Granada", code: "+1" },
  { value: "Guyana", label: "Guyana", code: "+592" },
  { value: "Jamaica", label: "Jamaica", code: "+1" },
  { value: "San Cristóbal y Nieves", label: "San Cristóbal y Nieves", code: "+1" },
  { value: "Santa Lucía", label: "Santa Lucía", code: "+1" },
  { value: "San Vicente y las Granadinas", label: "San Vicente y las Granadinas", code: "+1" },
  { value: "Trinidad y Tobago", label: "Trinidad y Tobago", code: "+1" },
];
