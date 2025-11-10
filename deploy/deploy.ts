import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const deployedFHERockPaperScissors = await deploy("FHERockPaperScissors", {
    from: deployer,
    log: true,
  });

  console.log(`FHERockPaperScissors contract: `, deployedFHERockPaperScissors.address);
};
export default func;
func.id = "deploy_fheRockPaperScissors"; // id required to prevent reexecution
func.tags = ["FHERockPaperScissors"];
