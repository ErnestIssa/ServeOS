import { MenuQrGeneratorContent } from "./MenuQrGeneratorContent";
import { MenuSection } from "./MenuPageUi";

type Props = {
  token: string;
  restaurantId: string;
};

export function MenuQrCodesPanel({ token, restaurantId }: Props) {
  return (
    <MenuSection
      title="QR codes"
      description="Generate guest ordering links and printable QR codes for tables or pickup points."
    >
      <MenuQrGeneratorContent token={token} restaurantId={restaurantId} />
    </MenuSection>
  );
}
