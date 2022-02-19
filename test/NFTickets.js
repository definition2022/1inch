const { ether, expectRevert, constants } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const ethSigUtil = require('eth-sig-util');
const Wallet = require('ethereumjs-wallet').default;

const NFTMock = artifacts.require('NFTMock');
const TokenMock = artifacts.require('TokenMock');
const LimitOrderProtocol = artifacts.require('LimitOrderProtocol');
const AggregatorMock = artifacts.require('AggregatorMock');

const { buildOrderData } = require('./helpers/orderUtils');
const { toBN, cutLastArg } = require('./helpers/utils');

describe('NFTickets', async function () {
    let _, wallet, addr1;
    const privatekey = '59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
    const account = Wallet.fromPrivateKey(Buffer.from(privatekey, 'hex'));

    function buildInverseWithSpread (inverse, spread) {
        return toBN(spread).setn(255, inverse).toString();
    }

    function buildSinglePriceGetter (swap, oracle, inverse, spread, amount = '0') {
        return swap.contract.methods.singlePrice(oracle.address, buildInverseWithSpread(inverse, spread), amount).encodeABI();
    }

    // eslint-disable-next-line no-unused-vars
    function buildDoublePriceGetter (swap, oracle1, oracle2, spread, amount = '0') {
        return swap.contract.methods.doublePrice(oracle1.address, oracle2.address, buildInverseWithSpread(false, spread), '0', amount).encodeABI();
    }

    function buildOrder (
        salt,
        makerAsset,
        takerAsset,
        makingAmount,
        takingAmount,
        makerGetter,
        takerGetter,
        allowedSender = constants.ZERO_ADDRESS,
        predicate = '0x',
        permit = '0x',
        interaction = '0x',
    ) {
        return {
            salt: salt,
            makerAsset: makerAsset.address,
            takerAsset: takerAsset.address,
            maker: wallet,
            receiver: constants.ZERO_ADDRESS,
            allowedSender,
            makingAmount,
            takingAmount,
            makerAssetData: '0x',
            takerAssetData: '0x',
            getMakerAmount: makerGetter,
            getTakerAmount: takerGetter,
            predicate,
            permit,
            interaction,
        };
    }

    before(async function () {
        [_, wallet, addr1] = await web3.eth.getAccounts();
    });

    beforeEach(async function () {
        this.dai = await TokenMock.new('DAI', 'DAI');
        this.weth = await TokenMock.new('WETH', 'WETH');
        this.inch = await TokenMock.new('1INCH', '1INCH');
        this.morg = await TokenMock.new('Morgenshtern', 'MORG');//await NFTMock.new("Morgenshtern", "MORG");
        
        //console.log(this.weth);
        //console.log(this.nft);
        this.swap = await LimitOrderProtocol.new();

        // We get the chain id from the contract because Ganache (used for coverage) does not return the same chain id
        // from within the EVM as from the JSON RPC interface.
        // See https://github.com/trufflesuite/ganache-core/issues/515
        this.chainId = await this.dai.getChainId();

        await this.dai.mint(wallet, ether('1000000'));
        // await this.weth.mint(wallet, ether('1000000'));
        await this.inch.mint(wallet, ether('1000000'));
        await this.dai.mint(_, ether('1000000'));
        await this.weth.mint(_, ether('1000000'));
        await this.inch.mint(_, ether('1000000'));
        await this.morg.mint(wallet, 10);
        // await this.morg.safeMint(wallet, '1');
        // await this.morg.safeMint(wallet, '2');
        // await this.morg.safeMint(wallet, '3');
        // await this.morg.safeMint(wallet, '4');
        // await this.morg.safeMint(wallet, '5');
        // await this.morg.safeMint(wallet, '6');
        // await this.morg.safeMint(wallet, '7');
        // await this.morg.safeMint(wallet, '8');
        // await this.morg.safeMint(wallet, '9');
        // await this.morg.safeMint(wallet, '10');
        let balance = await this.morg.balanceOf(wallet)
        console.log("Issued " + balance + " NFT tickets");

        await this.dai.approve(this.swap.address, ether('1000000'));
        await this.weth.approve(this.swap.address, ether('1000000'));
        await this.inch.approve(this.swap.address, ether('1000000'));
        await this.morg.approve(this.swap.address, 10);
        // await this.morg.setApprovalForAll(this.swap.address, true);
        await this.dai.approve(this.swap.address, ether('1000000'), { from: wallet });
        await this.weth.approve(this.swap.address, ether('1000000'), { from: wallet });
        await this.inch.approve(this.swap.address, ether('1000000'), { from: wallet });
        await this.morg.approve(this.swap.address, 10, { from: wallet });

        this.daiOracle = await AggregatorMock.new(ether('0.00025'));
        this.ethOracle = await AggregatorMock.new(ether('3000'));
        this.inchOracle = await AggregatorMock.new('1577615249227853');
    });

    it('NFT sell', async function () {
        const order = buildOrder(
            '1', this.morg, this.weth, '1'.toString(), ether('1000').toString(),'0x','0x',
        );

        const data = buildOrderData(this.chainId, this.swap.address, order);
        const signature = ethSigUtil.signTypedMessage(account.getPrivateKey(), { data });

        const makerMorg = await this.morg.balanceOf(wallet);
        const takerMorg = await this.morg.balanceOf(_);
        const makerWeth = await this.weth.balanceOf(wallet);
        const takerWeth = await this.weth.balanceOf(_);
        console.log("Balances: %s %s %s %s", makerMorg, takerMorg, makerWeth, takerWeth );

        await this.swap.fillOrder(order, signature, 0, ether('1000'), 1); 

        const makerMorg1 = await this.morg.balanceOf(wallet);
        const takerMorg1 = await this.morg.balanceOf(_);
        const makerWeth1 = await this.weth.balanceOf(wallet);
        const takerWeth1 = await this.weth.balanceOf(_);
        console.log("Balances: %d %d %d %d", makerMorg1, takerMorg1, makerWeth1/10**18, takerWeth1/10**18 );

        expect(await this.morg.balanceOf(wallet)).to.be.bignumber.equal(makerMorg.sub(web3.utils.toBN('1')));
        expect(await this.morg.balanceOf(_)).to.be.bignumber.equal(takerMorg.add(web3.utils.toBN('1')));
        expect(await this.weth.balanceOf(wallet)).to.be.bignumber.equal(makerWeth.add(ether('1000')));
        expect(await this.weth.balanceOf(_)).to.be.bignumber.equal(takerWeth.sub(ether('1000')));
    });

    describe('VIP ticket', async function () {
        it('should fill with correct taker', async function () {
            const order = buildOrder(
                '1', this.morg, this.weth, '1'.toString(), '1'.toString(),'0x','0x',
            );
            // order.allowedSender = _;
            const data = buildOrderData(this.chainId, this.swap.address, order);
            const signature = ethSigUtil.signTypedMessage(account.getPrivateKey(), { data });

            const makerMorg = await this.morg.balanceOf(wallet);
            const takerMorg = await this.morg.balanceOf(_);
            const makerWeth = await this.weth.balanceOf(wallet);
            const takerWeth = await this.weth.balanceOf(_);
            console.log("Balances: %s %s %s %s", makerMorg, takerMorg, makerWeth, takerWeth );

            await this.swap.fillOrder(order, signature, 0, 1, 1); 

            expect(await this.morg.balanceOf(wallet)).to.be.bignumber.equal(makerMorg.sub(web3.utils.toBN('1')));
            expect(await this.morg.balanceOf(_)).to.be.bignumber.equal(takerMorg.add(web3.utils.toBN('1')));
            expect(await this.weth.balanceOf(wallet)).to.be.bignumber.equal(makerWeth.add(web3.utils.toBN('1')));
            expect(await this.weth.balanceOf(_)).to.be.bignumber.equal(takerWeth.sub(web3.utils.toBN('1')));
        });

        it('should not fill with incorrect taker', async function () {
            const order = buildOrder(
                '1', this.morg, this.weth, '1'.toString(), '1'.toString(),'0x','0x',
            );
            order.allowedSender = wallet;
            const data = buildOrderData(this.chainId, this.swap.address, order);
            const signature = ethSigUtil.signTypedMessage(account.getPrivateKey(), { data });

            await expectRevert(
                this.swap.fillOrder(order, signature, 0, 1, 1),
                'LOP: private order',
            );
        });
    });

});
